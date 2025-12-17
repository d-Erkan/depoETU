/**
 * Contract Interaction Utilities
 * High-level functions for interacting with StudentSocialPlatform smart contract
 */

import { ethers } from 'ethers';
import { 
  estimateGas, 
  getGasPriceInfo, 
  calculateTxCost,
  waitForTransaction,
  parseTransactionError 
} from './web3Utils';

/**
 * Create a new post on blockchain
 * @param {ethers.Contract} contract - Contract instance
 * @param {string} content - Post content
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Transaction receipt with post ID
 */
export const createPostOnChain = async (contract, content, onProgress) => {
  try {
    onProgress?.('Estimating gas...');
    
    // Estimate gas
    const gasEstimate = await estimateGas(contract, 'createPost', [content]);
    
    onProgress?.('Getting gas price...');
    
    // Get gas price
    const provider = contract.runner.provider;
    const { gasPrice } = await getGasPriceInfo(provider);
    
    // Calculate cost
    const estimatedCost = calculateTxCost(gasEstimate, gasPrice);
    console.log(`Estimated cost: ${estimatedCost} ETH`);
    
    onProgress?.('Sending transaction...');
    
    // Send transaction
    const tx = await contract.createPost(content, {
      gasLimit: gasEstimate + 20000n // Add buffer
    });
    
    onProgress?.(`Transaction sent: ${tx.hash}`);
    
    // Wait for confirmation
    const receipt = await waitForTransaction(tx, 1, 120000);
    
    onProgress?.('Transaction confirmed!');
    
    // Parse event to get post ID
    const postCreatedEvent = receipt.logs.find(log => {
      try {
        const parsed = contract.interface.parseLog(log);
        return parsed.name === 'PostCreated';
      } catch {
        return false;
      }
    });
    
    let postId = null;
    if (postCreatedEvent) {
      const parsed = contract.interface.parseLog(postCreatedEvent);
      postId = Number(parsed.args.postId);
    }
    
    return {
      receipt,
      postId,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber
    };
    
  } catch (error) {
    const errorMessage = parseTransactionError(error);
    throw new Error(errorMessage);
  }
};

/**
 * Upvote a post on blockchain
 * @param {ethers.Contract} contract - Contract instance
 * @param {number} postId - Post ID
 * @returns {Promise<Object>} Transaction receipt
 */
export const upvotePostOnChain = async (contract, postId) => {
  try {
    // Estimate gas
    const gasEstimate = await estimateGas(contract, 'upvote', [postId]);
    
    // Send transaction
    const tx = await contract.upvote(postId, {
      gasLimit: gasEstimate + 10000n
    });
    
    console.log(`Upvote transaction sent: ${tx.hash}`);
    
    // Wait for confirmation
    const receipt = await waitForTransaction(tx);
    
    return {
      receipt,
      txHash: receipt.hash
    };
    
  } catch (error) {
    const errorMessage = parseTransactionError(error);
    throw new Error(errorMessage);
  }
};

/**
 * Downvote a post on blockchain
 * @param {ethers.Contract} contract - Contract instance
 * @param {number} postId - Post ID
 * @returns {Promise<Object>} Transaction receipt
 */
export const downvotePostOnChain = async (contract, postId) => {
  try {
    // Estimate gas
    const gasEstimate = await estimateGas(contract, 'downvote', [postId]);
    
    // Send transaction
    const tx = await contract.downvote(postId, {
      gasLimit: gasEstimate + 10000n
    });
    
    console.log(`Downvote transaction sent: ${tx.hash}`);
    
    // Wait for confirmation
    const receipt = await waitForTransaction(tx);
    
    return {
      receipt,
      txHash: receipt.hash
    };
    
  } catch (error) {
    const errorMessage = parseTransactionError(error);
    throw new Error(errorMessage);
  }
};

/**
 * Fetch a single post from blockchain
 * @param {ethers.Contract} contract - Contract instance
 * @param {number} postId - Post ID
 * @returns {Promise<Object>} Post data
 */
export const fetchPost = async (contract, postId) => {
  try {
    const post = await contract.posts(postId);
    
    if (!post.exists) {
      return null;
    }
    
    return {
      id: Number(post.id),
      author: post.author,
      content: post.content,
      timestamp: Number(post.timestamp),
      voteScore: Number(post.voteScore),
      exists: post.exists
    };
  } catch (error) {
    console.error(`Error fetching post ${postId}:`, error);
    return null;
  }
};

/**
 * Fetch all posts from blockchain
 * @param {ethers.Contract} contract - Contract instance
 * @returns {Promise<Array>} Array of posts
 */
export const fetchAllPosts = async (contract) => {
  try {
    const postCount = await contract.postCount();
    const totalPosts = Number(postCount);
    
    console.log(`Fetching ${totalPosts} posts from blockchain...`);
    
    const posts = [];
    
    // Fetch posts in parallel
    const promises = [];
    for (let i = 1; i <= totalPosts; i++) {
      promises.push(fetchPost(contract, i));
    }
    
    const results = await Promise.all(promises);
    
    // Filter out null results and reverse (newest first)
    return results.filter(post => post !== null).reverse();
    
  } catch (error) {
    console.error('Error fetching all posts:', error);
    throw error;
  }
};

/**
 * Get user's reputation from blockchain
 * @param {ethers.Contract} contract - Contract instance
 * @param {string} address - User address
 * @returns {Promise<number>} Reputation score
 */
export const getUserReputation = async (contract, address) => {
  try {
    const reputation = await contract.reputation(address);
    return Number(reputation);
  } catch (error) {
    console.error('Error fetching reputation:', error);
    return 0;
  }
};

/**
 * Check if user has voted on a post
 * @param {ethers.Contract} contract - Contract instance
 * @param {number} postId - Post ID
 * @param {string} userAddress - User address
 * @returns {Promise<number>} Vote status: -1 (downvote), 0 (no vote), 1 (upvote)
 */
export const getUserVote = async (contract, postId, userAddress) => {
  try {
    const vote = await contract.votes(postId, userAddress);
    return Number(vote);
  } catch (error) {
    console.error('Error fetching user vote:', error);
    return 0;
  }
};

/**
 * Get posts by a specific author
 * @param {ethers.Contract} contract - Contract instance
 * @param {string} authorAddress - Author address
 * @returns {Promise<Array>} Array of posts by author
 */
export const getPostsByAuthor = async (contract, authorAddress) => {
  try {
    const allPosts = await fetchAllPosts(contract);
    return allPosts.filter(post => 
      post.author.toLowerCase() === authorAddress.toLowerCase()
    );
  } catch (error) {
    console.error('Error fetching posts by author:', error);
    return [];
  }
};

/**
 * Get top posts by vote score
 * @param {ethers.Contract} contract - Contract instance
 * @param {number} limit - Number of posts to return
 * @returns {Promise<Array>} Top posts
 */
export const getTopPosts = async (contract, limit = 10) => {
  try {
    const allPosts = await fetchAllPosts(contract);
    return allPosts
      .sort((a, b) => b.voteScore - a.voteScore)
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching top posts:', error);
    return [];
  }
};

/**
 * Subscribe to new post events
 * @param {ethers.Contract} contract - Contract instance
 * @param {Function} callback - Callback with post data
 * @returns {Function} Unsubscribe function
 */
export const subscribeToNewPosts = (contract, callback) => {
  const filter = contract.filters.PostCreated();
  
  const listener = (postId, author, content, timestamp, event) => {
    callback({
      postId: Number(postId),
      author,
      content,
      timestamp: Number(timestamp),
      txHash: event.log.transactionHash
    });
  };
  
  contract.on(filter, listener);
  
  // Return unsubscribe function
  return () => {
    contract.off(filter, listener);
  };
};

/**
 * Subscribe to vote events
 * @param {ethers.Contract} contract - Contract instance
 * @param {Function} callback - Callback with vote data
 * @returns {Function} Unsubscribe function
 */
export const subscribeToVotes = (contract, callback) => {
  const filter = contract.filters.Voted();
  
  const listener = (postId, voter, postAuthor, voteType, newVoteScore, newAuthorReputation, event) => {
    callback({
      postId: Number(postId),
      voter,
      postAuthor,
      voteType: Number(voteType),
      newVoteScore: Number(newVoteScore),
      newAuthorReputation: Number(newAuthorReputation),
      txHash: event.log.transactionHash
    });
  };
  
  contract.on(filter, listener);
  
  // Return unsubscribe function
  return () => {
    contract.off(filter, listener);
  };
};

/**
 * Get contract statistics
 * @param {ethers.Contract} contract - Contract instance
 * @returns {Promise<Object>} Contract stats
 */
export const getContractStats = async (contract) => {
  try {
    const postCount = await contract.postCount();
    const allPosts = await fetchAllPosts(contract);
    
    const totalVotes = allPosts.reduce((sum, post) => sum + Math.abs(post.voteScore), 0);
    const avgVoteScore = allPosts.length > 0 
      ? allPosts.reduce((sum, post) => sum + post.voteScore, 0) / allPosts.length 
      : 0;
    
    return {
      totalPosts: Number(postCount),
      totalVotes,
      averageVoteScore: avgVoteScore.toFixed(2),
      postsWithPositiveScore: allPosts.filter(p => p.voteScore > 0).length,
      postsWithNegativeScore: allPosts.filter(p => p.voteScore < 0).length
    };
  } catch (error) {
    console.error('Error fetching contract stats:', error);
    return null;
  }
};
