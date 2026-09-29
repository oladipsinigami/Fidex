export const REGISTRY_CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_FIDEX_REGISTRY_ADDRESS ||
  process.env.NEXT_PUBLIC_ARCGRADE_REGISTRY_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const ATTESTATION_DOMAIN = {
  name: "Fidex Studio",
  version: "1",
  chainId: 5042002,
  verifyingContract: REGISTRY_CONTRACT_ADDRESS,
} as const;

export const ATTESTATION_TYPES = {
  RatingAttestation: [
    { name: "slug", type: "string" },
    { name: "letter", type: "string" },
    { name: "score", type: "uint256" },
    { name: "analyst", type: "address" },
    { name: "timestamp", type: "uint256" },
  ],
} as const;
