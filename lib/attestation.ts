export const ATTESTATION_DOMAIN = {
  name: "ArcGrade Studio",
  version: "1",
  chainId: 5042002,
  verifyingContract: "0x3600000000000000000000000000000000000000" as `0x${string}`,
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
