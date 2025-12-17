// require('@nomicfoundation/hardhat-toolbox');

// module.exports = {
//   solidity: '0.8.20',
// };
// require('@nomicfoundation/hardhat-toolbox');
// require("dotenv").config();

// module.exports = {
//   solidity: '0.8.20',
//   networks: {
//     sepolia: {
//       url: `https://eth-sepolia.g.alchemy.com/v2/4Ui6FJKO0JRlVoxgfzSUh`,
//       accounts: ['0xae17b2e15f77bf3fe8b5bece6f733b71b7ad87f02bbcb8382b796abafe209ec0'] // From MetaMask
//     }
//   }
// };

// console.log("PK length:", process.env.PRIVATE_KEY?.length);

require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

module.exports = {
  solidity: '0.8.20',
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || '',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
};