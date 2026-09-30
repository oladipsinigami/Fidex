// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {FidexRegistry}   from "../src/FidexRegistry.sol";

/// @title  DeployFidex
/// @notice Forge deployment script for FidexRegistry on Circle Arc Mainnet or Testnet.
///
/// Usage — with Encrypted Keystore (Recommended):
///   forge script script/DeployFidex.s.sol:DeployFidex \
///     --rpc-url https://rpc.mainnet.arc.io \
///     --account defaultkey \
///     --broadcast \
///     -vvvv
///
/// Usage — with Private Key env var:
///   DEPLOYER_PRIVATE_KEY=0x... forge script script/DeployFidex.s.sol:DeployFidex \
///     --rpc-url https://rpc.mainnet.arc.io \
///     --broadcast \
///     -vvvv
contract DeployFidex is Script {
    function run() external returns (address deployed) {
        uint256 deployerKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));

        if (deployerKey != 0) {
            vm.startBroadcast(deployerKey);
        } else {
            vm.startBroadcast();
        }

        FidexRegistry registry = new FidexRegistry();
        vm.stopBroadcast();

        deployed = address(registry);

        console.log("FidexRegistry deployed at:", deployed);
        console.log("Chain ID               :", block.chainid);
        console.log("Deployer               :", msg.sender);
    }
}
