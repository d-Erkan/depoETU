/**
 * Web3 Utility Functions for depo ETU Platform
 * Handles blockchain interactions, network management, and error handling
 */

import { ethers } from 'ethers';

/**
 * Check if MetaMask is installed
 * @returns {boolean} True if MetaMask is available
 */
export const isMetaMaskInstalled = () => {
  return typeof window.ethereum !== 'undefined';
};

/**
 * Request account access from MetaMask
 * @returns {Promise<string[]>} Array of account addresses
 */
export const requestAccounts = async () => {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed');
  }
  
  try {
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    return accounts;
  } catch (error) {
    if (error.code === 4001) {
      throw new Error('User rejected the connection request');
    }
    throw error;
  }
};

/**
 * Get the current network/chain ID
 * @param {ethers.BrowserProvider} provider - Ethers provider instance
 * @returns {Promise<bigint>} Chain ID
 */
export const getChainId = async (provider) => {
  const network = await provider.getNetwork();
  return network.chainId;
};

/**
 * Check if connected to correct network
 * @param {ethers.BrowserProvider} provider - Ethers provider instance
 * @returns {Promise<boolean>} True if on localhost or Sepolia
 */
export const isCorrectNetwork = async (provider) => {
  const chainId = await getChainId(provider);
  // 31337 = Hardhat localhost, 11155111 = Sepolia testnet
  return chainId === 31337n || chainId === 11155111n;
};

/**
 * Switch to a specific network
 * @param {string} chainId - Hex chain ID (e.g., '0x7A69' for localhost)
 */
export const switchNetwork = async (chainId) => {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });
  } catch (error) {
    // This error code indicates that the chain has not been added to MetaMask
    if (error.code === 4902) {
      throw new Error('Please add this network to MetaMask first');
    }
    throw error;
  }
};

/**
 * Add Sepolia network to MetaMask
 */
export const addSepoliaNetwork = async () => {
  try {
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: '0xaa36a7', // 11155111 in hex
        chainName: 'Sepolia Test Network',
        nativeCurrency: {
          name: 'Sepolia ETH',
          symbol: 'SepoliaETH',
          decimals: 18
        },
        rpcUrls: ['https://sepolia.infura.io/v3/'],
        blockExplorerUrls: ['https://sepolia.etherscan.io']
      }],
    });
  } catch (error) {
    console.error('Failed to add Sepolia network:', error);
    throw error;
  }
};

/**
 * Format address for display (0x1234...5678)
 * @param {string} address - Full Ethereum address
 * @param {number} startChars - Number of characters to show at start
 * @param {number} endChars - Number of characters to show at end
 * @returns {string} Formatted address
 */
export const formatAddress = (address, startChars = 6, endChars = 4) => {
  if (!address) return '';
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

/**
 * Get ETH balance of an address
 * @param {ethers.BrowserProvider} provider - Ethers provider instance
 * @param {string} address - Ethereum address
 * @returns {Promise<string>} Formatted balance in ETH
 */
export const getBalance = async (provider, address) => {
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
};

/**
 * Estimate gas for a transaction
 * @param {ethers.Contract} contract - Contract instance
 * @param {string} method - Method name
 * @param {Array} args - Method arguments
 * @returns {Promise<bigint>} Estimated gas
 */
export const estimateGas = async (contract, method, args = []) => {
  try {
    const gasEstimate = await contract[method].estimateGas(...args);
    return gasEstimate;
  } catch (error) {
    console.error('Gas estimation failed:', error);
    throw error;
  }
};

/**
 * Get current gas price with priority fee
 * @param {ethers.BrowserProvider} provider - Ethers provider instance
 * @returns {Promise<Object>} Gas price information
 */
export const getGasPriceInfo = async (provider) => {
  const feeData = await provider.getFeeData();
  return {
    gasPrice: feeData.gasPrice,
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
  };
};

/**
 * Calculate transaction cost
 * @param {bigint} gasEstimate - Estimated gas units
 * @param {bigint} gasPrice - Gas price in wei
 * @returns {string} Cost in ETH
 */
export const calculateTxCost = (gasEstimate, gasPrice) => {
  const cost = gasEstimate * gasPrice;
  return ethers.formatEther(cost);
};

/**
 * Wait for transaction confirmation with timeout
 * @param {Object} tx - Transaction object
 * @param {number} confirmations - Number of confirmations to wait for
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} Transaction receipt
 */
export const waitForTransaction = async (tx, confirmations = 1, timeout = 60000) => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Transaction timeout')), timeout);
  });
  
  const txPromise = tx.wait(confirmations);
  
  return Promise.race([txPromise, timeoutPromise]);
};

/**
 * Parse transaction error
 * @param {Error} error - Error object from transaction
 * @returns {string} User-friendly error message
 */
export const parseTransactionError = (error) => {
  if (error.code === 'ACTION_REJECTED') {
    return 'Transaction rejected by user';
  }
  if (error.code === 'INSUFFICIENT_FUNDS') {
    return 'Insufficient ETH balance for gas fees';
  }
  if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
    return 'Transaction may fail - unable to estimate gas';
  }
  if (error.code === 'NONCE_EXPIRED') {
    return 'Transaction failed - please try again';
  }
  if (error.message && error.message.includes('execution reverted')) {
    // Extract revert reason if available
    const match = error.message.match(/reverted: (.+)/);
    if (match) {
      return `Transaction failed: ${match[1]}`;
    }
    return 'Transaction reverted by contract';
  }
  return error.message || 'Unknown transaction error';
};

/**
 * Listen for account changes
 * @param {Function} callback - Callback function with new accounts
 */
export const onAccountsChanged = (callback) => {
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', callback);
  }
};

/**
 * Listen for network changes
 * @param {Function} callback - Callback function with new chain ID
 */
export const onChainChanged = (callback) => {
  if (window.ethereum) {
    window.ethereum.on('chainChanged', callback);
  }
};

/**
 * Remove all event listeners
 */
export const removeAllListeners = () => {
  if (window.ethereum && window.ethereum.removeAllListeners) {
    window.ethereum.removeAllListeners();
  }
};

/**
 * Get transaction details from hash
 * @param {ethers.BrowserProvider} provider - Ethers provider instance
 * @param {string} txHash - Transaction hash
 * @returns {Promise<Object>} Transaction details
 */
export const getTransactionDetails = async (provider, txHash) => {
  const tx = await provider.getTransaction(txHash);
  const receipt = await provider.getTransactionReceipt(txHash);
  
  return {
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    value: ethers.formatEther(tx.value),
    gasLimit: tx.gasLimit.toString(),
    gasPrice: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') : null,
    status: receipt ? (receipt.status === 1 ? 'Success' : 'Failed') : 'Pending',
    blockNumber: receipt?.blockNumber,
    confirmations: receipt ? await tx.confirmations() : 0
  };
};

/**
 * Get block timestamp
 * @param {ethers.BrowserProvider} provider - Ethers provider instance
 * @param {number} blockNumber - Block number
 * @returns {Promise<number>} Unix timestamp
 */
export const getBlockTimestamp = async (provider, blockNumber) => {
  const block = await provider.getBlock(blockNumber);
  return block.timestamp;
};

/**
 * Convert timestamp to readable date
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date string
 */
export const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Check if transaction was successful
 * @param {Object} receipt - Transaction receipt
 * @returns {boolean} True if successful
 */
export const isTransactionSuccessful = (receipt) => {
  return receipt && receipt.status === 1;
};

/**
 * Get Etherscan URL for transaction
 * @param {string} txHash - Transaction hash
 * @param {bigint} chainId - Chain ID
 * @returns {string} Etherscan URL
 */
export const getEtherscanUrl = (txHash, chainId) => {
  if (chainId === 11155111n) {
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  }
  if (chainId === 1n) {
    return `https://etherscan.io/tx/${txHash}`;
  }
  return null; // Localhost doesn't have block explorer
};
