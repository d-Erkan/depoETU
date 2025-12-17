const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StudentSocialPlatform", function () {
  let platform;
  let owner, user1, user2, user3;

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();
    const Platform = await ethers.getContractFactory("StudentSocialPlatform");
    platform = await Platform.deploy();
  });

  describe("Post Creation", function () {
    it("Should create a post successfully", async function () {
      await platform.connect(user1).createPost("My first post!");
      const post = await platform.getPost(1);
      
      expect(post.content).to.equal("My first post!");
      expect(post.author).to.equal(user1.address);
      expect(post.voteScore).to.equal(0);
    });

    it("Should reject empty posts", async function () {
      await expect(
        platform.connect(user1).createPost("")
      ).to.be.revertedWith("Post content cannot be empty");
    });

    it("Should increment post count", async function () {
      await platform.connect(user1).createPost("Post 1");
      await platform.connect(user2).createPost("Post 2");
      
      const count = await platform.getTotalPosts();
      expect(count).to.equal(2);
    });
  });

  describe("Upvoting", function () {
    beforeEach(async function () {
      await platform.connect(user1).createPost("Test post");
    });

    it("Should upvote and increase reputation", async function () {
      await platform.connect(user2).upvote(1);
      
      const post = await platform.getPost(1);
      const rep = await platform.getReputation(user1.address);
      
      expect(post.voteScore).to.equal(1);
      expect(rep).to.equal(1);
    });

    it("Should prevent double upvoting", async function () {
      await platform.connect(user2).upvote(1);
      
      await expect(
        platform.connect(user2).upvote(1)
      ).to.be.revertedWith("Already upvoted this post");
    });

    it("Should prevent self-upvoting", async function () {
      await expect(
        platform.connect(user1).upvote(1)
      ).to.be.revertedWith("Cannot vote on your own post");
    });

    it("Should allow multiple users to upvote", async function () {
      await platform.connect(user2).upvote(1);
      await platform.connect(user3).upvote(1);
      
      const post = await platform.getPost(1);
      const rep = await platform.getReputation(user1.address);
      
      expect(post.voteScore).to.equal(2);
      expect(rep).to.equal(2);
    });
  });

  describe("Downvoting", function () {
    beforeEach(async function () {
      await platform.connect(user1).createPost("Test post");
    });

    it("Should downvote and decrease reputation", async function () {
      await platform.connect(user2).downvote(1);
      
      const post = await platform.getPost(1);
      const rep = await platform.getReputation(user1.address);
      
      expect(post.voteScore).to.equal(-1);
      expect(rep).to.equal(-1);
    });

    it("Should prevent double downvoting", async function () {
      await platform.connect(user2).downvote(1);
      
      await expect(
        platform.connect(user2).downvote(1)
      ).to.be.revertedWith("Already downvoted this post");
    });
  });

  describe("Vote Changing", function () {
    beforeEach(async function () {
      await platform.connect(user1).createPost("Test post");
    });

    it("Should change from upvote to downvote", async function () {
      await platform.connect(user2).upvote(1);
      await platform.connect(user2).downvote(1);
      
      const post = await platform.getPost(1);
      const rep = await platform.getReputation(user1.address);
      
      expect(post.voteScore).to.equal(-1);
      expect(rep).to.equal(-1);
    });

    it("Should change from downvote to upvote", async function () {
      await platform.connect(user2).downvote(1);
      await platform.connect(user2).upvote(1);
      
      const post = await platform.getPost(1);
      const rep = await platform.getReputation(user1.address);
      
      expect(post.voteScore).to.equal(1);
      expect(rep).to.equal(1);
    });
  });

  describe("View Functions", function () {
    it("Should get vote status", async function () {
      await platform.connect(user1).createPost("Test post");
      await platform.connect(user2).upvote(1);
      
      const vote = await platform.getVote(1, user2.address);
      expect(vote).to.equal(1);
    });

    it("Should return 0 for no vote", async function () {
      await platform.connect(user1).createPost("Test post");
      
      const vote = await platform.getVote(1, user2.address);
      expect(vote).to.equal(0);
    });

    it("Should reject getting non-existent post", async function () {
      await expect(
        platform.getPost(999)
      ).to.be.revertedWith("Post does not exist");
    });
  });
});