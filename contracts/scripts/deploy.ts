import { ethers } from "hardhat";

async function main() {
  // 获取部署者账户
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // 获取合约工厂
  const LostItemNFTFactory = await ethers.getContractFactory("LostItemNFT");

  // 部署合约
  const nft = await LostItemNFTFactory.deploy();

  // 等待合约部署完成
  await nft.waitForDeployment();

  // 获取并打印合约地址
  const nftAddress = await nft.getAddress();
  console.log(`LostItemNFT deployed to: ${nftAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
