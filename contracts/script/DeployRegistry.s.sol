// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ArcGradeRegistry} from "../src/ArcGradeRegistry.sol";

contract DeployRegistry is Script {
    function run() external returns (ArcGradeRegistry registry) {
        uint256 deployerPrivateKey = vm.envOr(
            "PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );

        vm.startBroadcast(deployerPrivateKey);
        registry = new ArcGradeRegistry();
        vm.stopBroadcast();

        console.log("ArcGradeRegistry deployed to:", address(registry));
        console.log("Chain ID:", block.chainid);
        console.log("Domain Separator:", vm.toString(registry.domainSeparator()));
    }
}
