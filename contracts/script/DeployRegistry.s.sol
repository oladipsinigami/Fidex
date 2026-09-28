// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ArcGradeRegistry} from "../src/ArcGradeRegistry.sol";

contract DeployRegistry is Script {
    function run() external returns (ArcGradeRegistry registry) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        registry = new ArcGradeRegistry();
        vm.stopBroadcast();

        console.log("ArcGradeRegistry deployed to:", address(registry));
        console.log("Chain ID:", block.chainid);
        console.log("Domain Separator:", vm.toString(registry.domainSeparator()));
    }
}
