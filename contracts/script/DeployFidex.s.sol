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

        /**
         * Initial owner of the analyst allowlist.
         *
         * Cannot default to msg.sender: this is an indirect base-constructor
         * argument, and Solidity does not resolve msg.sender there. It is
         * therefore supplied explicitly and checked, so a misconfigured run
         * fails loudly instead of deploying a registry nobody controls -- or
         * one that is wide open.
         */
        address initialOwner = vm.envOr("REGISTRY_OWNER", address(0));
        if (initialOwner == address(0)) revert("REGISTRY_OWNER is required");
        if (initialOwner.code.length != 0) revert("REGISTRY_OWNER must be an EOA");

        /**
         * Analysts allowlisted at deployment.
         *
         * Empty by default: a fresh registry accepts no attestations until
         * someone is explicitly approved, which is the safe direction to fail.
         * Set INITIAL_ANALYSTS="0xabc...,0xdef..." to seed a set at deploy time.
         */
        address[] memory initialAnalysts = new address[](0);
        string memory seed = vm.envOr("INITIAL_ANALYSTS", string(""));
        if (bytes(seed).length > 0) {
            string[] memory parts = vm.split(seed, ",");
            uint256 n = parts.length;
            initialAnalysts = new address[](n);
            for (uint256 i; i < n; ++i) {
                initialAnalysts[i] = vm.parseAddress(vm.trim(parts[i]));
            }
        }

        FidexRegistry registry = new FidexRegistry(initialOwner, initialAnalysts);
        vm.stopBroadcast();

        deployed = address(registry);

        console.log("FidexRegistry deployed at:", deployed);
        console.log("Chain ID               :", block.chainid);
        console.log("Owner                  :", registry.owner());
        console.log("Initial analysts       :", initialAnalysts.length);
    }
}
