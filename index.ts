import { clusterApiUrl, Connection, Keypair, ParsedAccountData, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getMint, Mint, freezeAccount, thawAccount } from "@solana/spl-token";
import bs58 from 'bs58';

type ParsedTokenAccount = {
  owner: string;
  tokenAccount: string;
  balance: number;
}

const WHITELISTED_ACCOUNTS: string | any[] = [
]

/**
 *
 * ?README: Make sure the wallet with the private key provided is the freeze authority for the CA
 */
async function main() {
  //* switch to "mainnet-beta" for live network
  const network = "devnet"

  /**
   * PROVIDE @PK HERE
   * Don't commit to Git
   */
  const PRIVATE_KEY = "";
  /**
   * PROVIDE @PK HERE
   */

  /**
   * PROVIDE @CA HERE
   */
  const ca = "";
  /**
   * PROVIDE @CA HERE
   */

  type Mode = 'freeze' | 'thaw';
  const mode: Mode = "freeze";

  const signer = getKeypairFromPrivateKey(PRIVATE_KEY);
  const caKeypair = new PublicKey(ca)

  const connection = new Connection(clusterApiUrl(network))

  const tokenInfo: Mint = await getMint(connection, caKeypair);

  if (tokenInfo.freezeAuthority === null) {
    console.error("Please provide a CA with Freeze Authority Enabled");
    process.exit(1);
  } else {
    console.log("Freeze Authority enabled.");
    console.log("Continuing script...")
  }

  const atas = await findTokenAccounts(connection, caKeypair);
  let atasCount = atas.length;
  console.log(`Found ${atas?.length} accounts holding token ${ca}`)

  console.log(`Initializing ${mode} action:\n`)

  let success = 0;
  type TokenOperation = (
    connection: Connection,
    ca: PublicKey,
    signer: Keypair,
    account: PublicKey
  ) => Promise<string | null>;

  for (const ata of atas) {
    const randomInterval = Math.random() * 1000 + 500;
    await new Promise(resolve => setTimeout(resolve, randomInterval));
    if (WHITELISTED_ACCOUNTS.includes(ata.owner)) {
      console.log(`Account (${ata.owner}) found in WL. Skipping token freeze.`);
      atasCount -= 1;
      continue;
    }
    const modeFunction: TokenOperation = mode == 'freeze' ? freezeTokensForAta :thawTokensForAta;
    const result = await modeFunction(connection, caKeypair, signer, new PublicKey(ata.tokenAccount))
    console.log(result)
    if (result != null) {
      console.log(`Tokens ${mode === 'freeze' ? 'frozen': 'thawed'} for ${ata.owner}`)
      success++;
    } else {
      console.log(`Failed to thaw tokens for ${ata.owner}`)
    }
  }
  console.log(`Completed token ${mode}`)
  console.log(`${success}/${atasCount} ${mode === 'freeze' ? 'frozen': 'thawed'}`)
  process.exit(0)

}

async function findTokenAccounts(connection: Connection, mintPublicKey: PublicKey) {

  // Get all token accounts for the mint
  const tokenAccounts = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
    filters: [
      // Filter for accounts that belong to the specific mint
      {
        dataSize: 165, // Size of a token account
      },
      {
        memcmp: {
          offset: 0, // Mint address is at offset 0 in the account data
          bytes: mintPublicKey.toBase58(),
        },
      },
    ],
  });

  // Extract information from the accounts
  const ataInfo = tokenAccounts.map((account) => {
    const parsedAccountInfo = (account.account.data as ParsedAccountData).parsed.info;
    return {
      owner: parsedAccountInfo.owner,
      tokenAccount: account.pubkey.toBase58(),
      balance: parsedAccountInfo.tokenAmount.uiAmount,
    } as ParsedTokenAccount;
  });

  return ataInfo;
}

async function freezeTokensForAta(connection: Connection, ca: PublicKey, signer: Keypair, account: PublicKey) {
  try {
    const freezeTxId = await freezeAccount(connection, signer, account, ca, signer);
    return freezeTxId;
  } catch (error) {
    return null;
  }
}

async function thawTokensForAta(connection: Connection, ca: PublicKey, signer: Keypair, account: PublicKey) {
  try {
    const thawTxId = await thawAccount(connection, signer, account, ca, signer);
    return thawTxId;
  } catch (error) {
    return null;
  }
}

function getKeypairFromPrivateKey(privateKeyString: string): Keypair {
    const privateKeyBytes = bs58.decode(privateKeyString);
    return Keypair.fromSecretKey(privateKeyBytes);
}

try {
  main();
} catch (error) {
  console.log(error);
}