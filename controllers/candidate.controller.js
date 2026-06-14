import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { Candidate } from "../models/candidate.model.js";
import { isValidObjectId } from "mongoose";
import { VotingStatus } from "../models/votingStatus.model.js";
import { User } from "../models/user.model.js";


const createCandidate = asyncHandler(async (req, res) => {
  const { name, party, age } = req.body;
  if (!name) {
    throw new ApiError(400, "Candidate name is required");
  }
  if (!party) {
    throw new ApiError(400, "Candidate party is required");
  }
  if (!age) {
    throw new ApiError(400, "Candidate age is required");
  }

  const existedCandidate = await Candidate.findOne({
    $or: [{ name }, { party }],
  });
  if (existedCandidate) {
    throw new ApiError(400, "Candidate with this name or party already exists");
  }

  const candidate = await Candidate.create({
    name,
    party,
    age,
    votes: [],
    votesCount: 0,
  });
  return res
    .status(201)
    .json(new ApiResponse(201, candidate, "Candidate created successfully"));
});

const updateCandidate = asyncHandler(async (req, res) => {
  const { candidateId } = req.params;
  const { name, party, age } = req.body;

  if (!isValidObjectId(candidateId)) {
    throw new ApiError(400, "invalid candidate id");
  }
  if (!(name || party || age)) {
    throw new ApiError(400, "At least one field is required to update");
  }

  const candidate = await Candidate.findByIdAndUpdate(
    candidateId,
    {
      $set: {
        name: name,
        party: party,
        age: age,
      },
    },
    { new: true }
  );
  if (!candidate) {
    throw new ApiError(404, "candidate not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, candidate, "candidate updated successfully"));
});

const deleteCandidate = asyncHandler(async (req, res) => {
  const { candidateId } = req.params;
  if (!isValidObjectId(candidateId)) {
    throw new ApiError(400, "invalid candidate id");
  }

  const deletedCandidate = await Candidate.findByIdAndDelete(candidateId);

  if (!deletedCandidate) {
    throw new ApiError(404, "Candidate not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Candidate removed successfully"));
});

const getAllCandidates = asyncHandler(async (req, res) => {
  const candidate = await Candidate.find().select("name party age");
  return res
    .status(200)
    .json(new ApiResponse(200, candidate, "List of candidates"));
});

const getCandidateById = asyncHandler(async (req, res) => {
  const { candidateId } = req.params;

  // Validate candidate id
  if (!isValidObjectId(candidateId)) {
    throw new ApiError(400, "Invalid candidate id");
  }

  const candidate = await Candidate.findById(candidateId);
  if (!candidate) {
    throw new ApiError(404, "Candidate not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, candidate, "Candidate fetched successfully"));
});

const voteForCandidate = asyncHandler(async (req, res) => {
  const { candidateId } = req.params;

  if (!isValidObjectId(candidateId)) {
    throw new ApiError(400, "Invalid candidate id");
  }

  const votingStatus = await VotingStatus.findOne();

  if (!votingStatus || !votingStatus.isVotingOpen) {
    throw new ApiError(403, "Voting is currently closed");
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.isVoted === true) {
    throw new ApiError(400, "You have already cast your vote");
  }

  const candidate = await Candidate.findById(candidateId);

  if (!candidate) {
    throw new ApiError(404, "Candidate not found");
  }

  // Prevent duplicate vote in candidate document
  candidate.votes.addToSet({
    user: user._id,
  });

  candidate.voteCount = candidate.votes.length;

  try {
    console.log("Saving candidate...");
    await candidate.save();
    console.log("Candidate saved successfully");

    user.isVoted = true;
    user.votedFor = candidate._id;

    console.log("User before save:", user);

    await user.save({ validateBeforeSave: false });

    console.log("User saved successfully");

    return res.status(200).json(
      new ApiResponse(
        200,
        candidate,
        "Vote submitted successfully"
      )
    );
  } catch (error) {
    console.error("Vote Error:", error);
    throw new ApiError(500, error.message);
  }
});

const votesCount = asyncHandler(async (req, res) => {
  const votingStatus = await VotingStatus.findOne(); 

  if (!votingStatus) {
    throw new ApiError(500, "Voting status not found");
  }

  if (req.user.role !== "admin" && votingStatus.isVotingOpen) {
    throw new ApiError(403, "Results will be available after voting ends");
  }

  const candidates = await Candidate.find().select("name party voteCount");

  if (!candidates || candidates.length === 0) {
    throw new ApiError(404, "No candidates found");
  }

  return res.status(200).json(
    new ApiResponse(200, candidates, "Vote counts fetched successfully")
  );
});

const resetVotes = asyncHandler(async (req, res) => {
  const result = await Candidate.updateMany({}, { $set: { votes: [], voteCount: 0 } });

  return res.status(200).json(
    new ApiResponse(200, {}, "All candidate votes have been reset to 0")
  );
});

export {
  createCandidate,
  updateCandidate,
  deleteCandidate,
  getAllCandidates,
  voteForCandidate,
  getCandidateById,
  votesCount,
  resetVotes
};
