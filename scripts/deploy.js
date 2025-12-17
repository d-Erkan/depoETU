const hre = require("hardhat");

async function main() {
  console.log("Deploying StudentSocialPlatform to Sepolia testnet...");
  console.log("Network:", hre.network.name);

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  // Deploy the contract
  const StudentSocialPlatform = await hre.ethers.getContractFactory("StudentSocialPlatform");
  console.log("Deploying contract...");
  
  const platform = await StudentSocialPlatform.deploy();
  await platform.waitForDeployment();

  const address = await platform.getAddress();
  console.log("\n✅ StudentSocialPlatform deployed successfully!");
  console.log("Contract address:", address);
  console.log("\nVerify with:");
  console.log(`npx hardhat verify --network sepolia ${address}`);
  
  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: address,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };
  
  console.log("\nDeployment Info:", JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });