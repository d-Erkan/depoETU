/**
 * Custom React Hooks for Blockchain Interactions
 */

import { useState, useEffect, useCallback } from 'react';
import { useBlockchain } from '../context/BlockchainContext';
import {
  createPostOnChain,
  upvotePostOnChain,
  downvotePostOnChain,
  fetchAllPosts,
  getUserReputation,
  getUserVote,
  subscribeToNewPosts,
  subscribeToVotes
} from '../utils/contractUtils';

/**
 * Hook for creating posts
 */
export const useCreatePost = () => {
  const { contract } = useBlockchain();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState('');

  const createPost = useCallback(async (content) => {
    if (!contract) {
      throw new Error('Contract not initialized');
    }

    setLoading(true);
    setError(null);

    try {
      const result = await createPostOnChain(contract, content, setProgress);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [contract]);

  return { createPost, loading, error, progress };
};

/**
 * Hook for voting on posts
 */
export const useVote = () => {
  const { contract } = useBlockchain();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const upvote = useCallback(async (postId) => {
    if (!contract) {
      throw new Error('Contract not initialized');
    }

    setLoading(true);
    setError(null);

    try {
      const result = await upvotePostOnChain(contract, postId);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [contract]);

  const downvote = useCallback(async (postId) => {
    if (!contract) {
      throw new Error('Contract not initialized');
    }

    setLoading(true);
    setError(null);

    try {
      const result = await downvotePostOnChain(contract, postId);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [contract]);

  return { upvote, downvote, loading, error };
};

/**
 * Hook for fetching posts
 */
export const usePosts = (autoRefresh = false, interval = 30000) => {
  const { contract } = useBlockchain();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPosts = useCallback(async () => {
    if (!contract) return;

    setLoading(true);
    setError(null);

    try {
      const allPosts = await fetchAllPosts(contract);
      setPosts(allPosts);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [contract]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Auto refresh
  useEffect(() => {
    if (autoRefresh && contract) {
      const intervalId = setInterval(fetchPosts, interval);
      return () => clearInterval(intervalId);
    }
  }, [autoRefresh, interval, fetchPosts, contract]);

  // Subscribe to new posts
  useEffect(() => {
    if (contract) {
      const unsubscribe = subscribeToNewPosts(contract, () => {
        fetchPosts();
      });
      return unsubscribe;
    }
  }, [contract, fetchPosts]);

  // Subscribe to votes
  useEffect(() => {
    if (contract) {
      const unsubscribe = subscribeToVotes(contract, () => {
        fetchPosts();
      });
      return unsubscribe;
    }
  }, [contract, fetchPosts]);

  return { posts, loading, error, refetch: fetchPosts };
};

/**
 * Hook for user reputation
 */
export const useReputation = (address) => {
  const { contract } = useBlockchain();
  const [reputation, setReputation] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchReputation = async () => {
      if (!contract || !address) return;

      setLoading(true);
      try {
        const rep = await getUserReputation(contract, address);
        setReputation(rep);
      } catch (err) {
        console.error('Error fetching reputation:', err);
      }
      setLoading(false);
    };

    fetchReputation();

    // Subscribe to vote events to update reputation
    if (contract) {
      const unsubscribe = subscribeToVotes(contract, (voteData) => {
        if (voteData.postAuthor.toLowerCase() === address.toLowerCase()) {
          setReputation(voteData.newAuthorReputation);
        }
      });
      return unsubscribe;
    }
  }, [contract, address]);

  return { reputation, loading };
};

/**
 * Hook for checking user's vote on a post
 */
export const useUserVote = (postId, userAddress) => {
  const { contract } = useBlockchain();
  const [voteStatus, setVoteStatus] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchVoteStatus = async () => {
      if (!contract || !postId || !userAddress) return;

      setLoading(true);
      try {
        const vote = await getUserVote(contract, postId, userAddress);
        setVoteStatus(vote);
      } catch (err) {
        console.error('Error fetching vote status:', err);
      }
      setLoading(false);
    };

    fetchVoteStatus();
  }, [contract, postId, userAddress]);

  return { voteStatus, loading };
};

/**
 * Hook for real-time event notifications
 */
export const useEventNotifications = () => {
  const { contract } = useBlockchain();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!contract) return;

    // Subscribe to new posts
    const unsubscribePosts = subscribeToNewPosts(contract, (postData) => {
      setNotifications(prev => [...prev, {
        type: 'post',
        message: `New post created by ${postData.author.slice(0, 6)}...`,
        timestamp: Date.now(),
        data: postData
      }]);
    });

    // Subscribe to votes
    const unsubscribeVotes = subscribeToVotes(contract, (voteData) => {
      const voteType = voteData.voteType === 1 ? 'upvoted' : 'downvoted';
      setNotifications(prev => [...prev, {
        type: 'vote',
        message: `Post #${voteData.postId} ${voteType}`,
        timestamp: Date.now(),
        data: voteData
      }]);
    });

    return () => {
      unsubscribePosts();
      unsubscribeVotes();
    };
  }, [contract]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return { notifications, clearNotifications };
};

/**
 * Hook for transaction status tracking
 */
export const useTransactionStatus = () => {
  const [transactions, setTransactions] = useState([]);

  const addTransaction = useCallback((tx) => {
    setTransactions(prev => [...prev, {
      ...tx,
      timestamp: Date.now(),
      status: 'pending'
    }]);
  }, []);

  const updateTransaction = useCallback((hash, updates) => {
    setTransactions(prev => prev.map(tx => 
      tx.hash === hash ? { ...tx, ...updates } : tx
    ));
  }, []);

  const removeTransaction = useCallback((hash) => {
    setTransactions(prev => prev.filter(tx => tx.hash !== hash));
  }, []);

  return {
    transactions,
    addTransaction,
    updateTransaction,
    removeTransaction
  };
};
