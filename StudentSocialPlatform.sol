// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title StudentSocialPlatform
 * @dev A decentralized anonymous social platform for students
 */
contract StudentSocialPlatform {
    
    // Struct to represent a post
    struct Post {
        uint256 id;
        address author;
        string content;
        uint256 timestamp;
        int256 voteScore; // Net votes (upvotes - downvotes)
        bool exists;
    }
    
    // State variables
    uint256 public postCount;
    
    // Mappings
    mapping(uint256 => Post) public posts; // postId => Post
    mapping(address => int256) public reputation; // user address => reputation score
    mapping(uint256 => mapping(address => int8)) public votes; // postId => voter => vote (-1, 0, 1)
    
    // Events
    event PostCreated(
        uint256 indexed postId,
        address indexed author,
        string content,
        uint256 timestamp
    );
    
    event Voted(
        uint256 indexed postId,
        address indexed voter,
        address indexed postAuthor,
        int8 voteType, // 1 for upvote, -1 for downvote
        int256 newVoteScore,
        int256 newAuthorReputation
    );
    
    /**
     * @dev Create a new post
     * @param _content The content of the post
     */
    function createPost(string memory _content) external {
        require(bytes(_content).length > 0, "Post content cannot be empty");
        require(bytes(_content).length <= 1000, "Post content too long (max 1000 chars)");
        
        postCount++;
        
        posts[postCount] = Post({
            id: postCount,
            author: msg.sender,
            content: _content,
            timestamp: block.timestamp,
            voteScore: 0,
            exists: true
        });
        
        emit PostCreated(postCount, msg.sender, _content, block.timestamp);
    }
    
    /**
     * @dev Upvote a post
     * @param _postId The ID of the post to upvote
     */
    function upvote(uint256 _postId) external {
        require(posts[_postId].exists, "Post does not exist");
        require(posts[_postId].author != msg.sender, "Cannot vote on your own post");
        require(votes[_postId][msg.sender] != 1, "Already upvoted this post");
        
        Post storage post = posts[_postId];
        int8 previousVote = votes[_postId][msg.sender];
        
        // Update vote
        votes[_postId][msg.sender] = 1;
        
        // Update post score
        if (previousVote == -1) {
            // Changing from downvote to upvote (+2)
            post.voteScore += 2;
            reputation[post.author] += 2;
        } else {
            // New upvote (+1)
            post.voteScore += 1;
            reputation[post.author] += 1;
        }
        
        emit Voted(_postId, msg.sender, post.author, 1, post.voteScore, reputation[post.author]);
    }
    
    /**
     * @dev Downvote a post
     * @param _postId The ID of the post to downvote
     */
    function downvote(uint256 _postId) external {
        require(posts[_postId].exists, "Post does not exist");
        require(posts[_postId].author != msg.sender, "Cannot vote on your own post");
        require(votes[_postId][msg.sender] != -1, "Already downvoted this post");
        
        Post storage post = posts[_postId];
        int8 previousVote = votes[_postId][msg.sender];
        
        // Update vote
        votes[_postId][msg.sender] = -1;
        
        // Update post score
        if (previousVote == 1) {
            // Changing from upvote to downvote (-2)
            post.voteScore -= 2;
            reputation[post.author] -= 2;
        } else {
            // New downvote (-1)
            post.voteScore -= 1;
            reputation[post.author] -= 1;
        }
        
        emit Voted(_postId, msg.sender, post.author, -1, post.voteScore, reputation[post.author]);
    }
    
    /**
     * @dev Get post details
     * @param _postId The ID of the post
     */
    function getPost(uint256 _postId) external view returns (
        uint256 id,
        address author,
        string memory content,
        uint256 timestamp,
        int256 voteScore
    ) {
        require(posts[_postId].exists, "Post does not exist");
        Post memory post = posts[_postId];
        return (post.id, post.author, post.content, post.timestamp, post.voteScore);
    }
    
    /**
     * @dev Get user's reputation
     * @param _user The address of the user
     */
    function getReputation(address _user) external view returns (int256) {
        return reputation[_user];
    }
    
    /**
     * @dev Get vote status for a post by a user
     * @param _postId The ID of the post
     * @param _user The address of the user
     */
    function getVote(uint256 _postId, address _user) external view returns (int8) {
        return votes[_postId][_user];
    }
    
    /**
     * @dev Get total number of posts
     */
    function getTotalPosts() external view returns (uint256) {
        return postCount;
    }
}