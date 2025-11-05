// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title LostItemNFT
 * @dev 基于ERC721的失物招领NFT合约.
 */
contract LostItemNFT is ERC721URIStorage, AccessControl {
    uint256 private _tokenIdCounter; // ID从1开始

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    event ItemMinted(
        uint256 indexed tokenId,
        address indexed finder,
        string tokenURI
    );

    event ItemClaimed(
        uint256 indexed tokenId,
        address indexed finder,
        address indexed loster
    );

    constructor() ERC721("LostAndFound", "LAF") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mintItem(address finder, string memory tokenURI)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256) 
    {
        _tokenIdCounter++;
        uint256 newItemId = _tokenIdCounter; 

        _safeMint(finder, newItemId);
        _setTokenURI(newItemId, tokenURI);

        emit ItemMinted(newItemId, finder, tokenURI);
        return newItemId;
    }

    function claimItem(address loster, uint256 tokenId) external {
        _checkAuthorized(ownerOf(tokenId), msg.sender, tokenId); 

        address finder = ownerOf(tokenId);
        _safeTransfer(finder, loster, tokenId, "");

        emit ItemClaimed(tokenId, finder, loster);
    }

    function updateTokenURI(uint256 tokenId, string memory newTokenURI)
        external
        onlyRole(MINTER_ROLE)
    {
        /* _checkAuthorized(ownerOf(tokenId), msg.sender, tokenId); */
        ownerOf(tokenId);

        _setTokenURI(tokenId, newTokenURI);
    }

    function _baseURI() internal pure override returns (string memory) {
        return ""; 
    }

    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        virtual 
        override(ERC721URIStorage, AccessControl)
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }
}
