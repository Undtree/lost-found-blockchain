import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

// 导入类型
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
// 导入 Hardhat 自动生成的合约类型
import type { LostItemNFT } from "../typechain-types"; 

describe("LostItemNFT 合约测试", function () {
  
  // 使用 "fixture" 函数，统一定义部署和设置流程
  async function deployLostItemNFTFixture() {
    // 1. 获取测试账户
    // 为账户添加类型
    const [deployer, finder, loster, randomUser]: SignerWithAddress[] = await ethers.getSigners();

    // 2. 获取合约工厂
    const LostItemNFTFactory = await ethers.getContractFactory("LostItemNFT");

    // 3. 部署合约
    // 为合约实例添加类型
    const nft: LostItemNFT = await LostItemNFTFactory.deploy();
    
    // 4. 获取合约中定义的角色哈希值
    const MINTER_ROLE = await nft.MINTER_ROLE();
    const ADMIN_ROLE = await nft.DEFAULT_ADMIN_ROLE();

    // 5. 定义一个标准的元数据URI用于测试
    const tokenURI = "http://my-server.com/api/metadata/1";

    // 6. 返回所有需要在测试中用到的变量
    return { 
      nft, 
      deployer, 
      finder, 
      loster, 
      randomUser, 
      MINTER_ROLE, 
      ADMIN_ROLE, 
      tokenURI 
    };
  }

  // 测试 1: 部署与角色
  describe("部署 (Deployment) 与 角色 (Roles)", function () {
    
    it("应该成功部署，并设置正确的NFT名称和符号", async function () {
      const { nft } = await loadFixture(deployLostItemNFTFixture);
      expect(await nft.name()).to.equal("LostAndFound");
      expect(await nft.symbol()).to.equal("LAF");
    });

    it("应该将 ADMIN_ROLE 和 MINTER_ROLE 授予部署者", async function () {
      const { nft, deployer, MINTER_ROLE, ADMIN_ROLE } = await loadFixture(deployLostItemNFTFixture);
      expect(await nft.hasRole(ADMIN_ROLE, deployer.address)).to.be.true;
      expect(await nft.hasRole(MINTER_ROLE, deployer.address)).to.be.true;
    });
  });

  // 测试 2: 铸造物品 (mintItem)
  describe("发布失物 (mintItem)", function () {
    
    it("应该允许 MINTER 成功铸造一个新的NFT给拾物者", async function () {
      const { nft, deployer, finder, tokenURI } = await loadFixture(deployLostItemNFTFixture);

      await expect(nft.connect(deployer).mintItem(finder.address, tokenURI))
        .to.emit(nft, "ItemMinted") 
        .withArgs(1, finder.address, tokenURI); 

      expect(await nft.ownerOf(1)).to.equal(finder.address);
      expect(await nft.tokenURI(1)).to.equal(tokenURI);
    });

    it("应该禁止非 MINTER 角色调用 mintItem", async function () {
      const { nft, finder, randomUser, tokenURI } = await loadFixture(deployLostItemNFTFixture);

      await expect(
        nft.connect(randomUser).mintItem(finder.address, tokenURI)
      ).to.be.revertedWithCustomError(nft, "AccessControlUnauthorizedAccount");
    });
  });

  // 测试 3: 认领物品 (claimItem)
  describe("认领失物 (claimItem)", function () {
    
    // 辅助函数，用于在测试前先铸造一个NFT (tokenId 1)
    async function mintOneItemFixture() {
      const { nft, deployer, finder, tokenURI, loster, randomUser } = await loadFixture(deployLostItemNFTFixture);
      // 部署者(后端)铸造一个NFT给finder
      await nft.connect(deployer).mintItem(finder.address, tokenURI);
      return { nft, deployer, finder, tokenURI, loster, randomUser };
    }

    it("应该允许 NFT 的当前所有者 (finder) 将其转移给失主 (loster)", async function () {
      const { nft, finder, loster } = await loadFixture(mintOneItemFixture);
      const tokenId = 1;

      await expect(nft.connect(finder).claimItem(loster.address, tokenId))
        .to.emit(nft, "ItemClaimed") 
        .withArgs(tokenId, finder.address, loster.address); 

      expect(await nft.ownerOf(tokenId)).to.equal(loster.address);
    });

    it("应该禁止非所有者 (如 randomUser) 尝试转移 NFT", async function () {
      const { nft, randomUser, loster } = await loadFixture(mintOneItemFixture);
      const tokenId = 1;

      await expect(
        nft.connect(randomUser).claimItem(loster.address, tokenId)
      ).to.be.revertedWithCustomError(nft, "ERC721InsufficientApproval");
    });

    it("应该禁止失主本人 (loster) 尝试自己调用 claimItem (因为他不是所有者)", async function () {
      const { nft, loster } = await loadFixture(mintOneItemFixture);
      const tokenId = 1;

      await expect(
        nft.connect(loster).claimItem(loster.address, tokenId)
      ).to.be.revertedWithCustomError(nft, "ERC721InsufficientApproval");
    });
  });

  // 测试 4: 更新 URI
  describe("更新元数据 (updateTokenURI)", function () {
    
    async function mintOneItemFixture() {
      const { nft, deployer, finder, tokenURI, loster, randomUser } = await loadFixture(deployLostItemNFTFixture);
      await nft.connect(deployer).mintItem(finder.address, tokenURI);
      return { nft, deployer, finder, tokenURI, loster, randomUser };
    }
    
    const newTokenURI = "http://my-server.com/api/metadata/1-updated";

    it("应该允许当前所有者 (finder) 更新 token URI", async function () {
      const { nft, finder } = await loadFixture(mintOneItemFixture);
      const tokenId = 1;

      await nft.connect(finder).updateTokenURI(tokenId, newTokenURI);
      expect(await nft.tokenURI(tokenId)).to.equal(newTokenURI);
    });

    it("应该禁止非所有者 (randomUser) 更新 token URI", async function () {
      const { nft, randomUser } = await loadFixture(mintOneItemFixture);
      const tokenId = 1;

      await expect(
        nft.connect(randomUser).updateTokenURI(tokenId, newTokenURI)
      ).to.be.revertedWithCustomError(nft, "ERC721InsufficientApproval");
    });
  });
});
