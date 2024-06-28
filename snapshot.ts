import { Lucid } from "https://deno.land/x/lucid@0.10.7/mod.ts";
import { parseArgs } from "@std/cli/parse-args";
import { supabase } from "./db.ts";

const isDenoDeploy = Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;

const flags = parseArgs(Deno.args, {
  boolean: ["debug", "local", "save"],
})

const lucid = await Lucid.new(undefined, "Mainnet")

const DISCO_NFT_POLICY_ID = 'd0112837f8f856b2ca14f69b375bc394e73d146fdadcc993bb993779'
const DISCO_TOKEN_POLICY_ID = '5612bee388219c1b76fd527ed0fa5aa1d28652838bcab4ee4ee63197'
const REWARD_TOTAL = 1828919.06301369;
const ADDRESS_BLACKLIST: string[] = [
  // Discoin Treasury
  'addr1xy306nxnhkseaw4rlgfa55skyd342z4mtq5k2j4jux7k4kfzl4xd80dpn6a287snmffpvgmr259tkkpfv49t9cdadtvssms0kr',
  // Discatalyst Treasury
  'addr1xxy8exmrl37hk2pyct5mgc45tjh53udzfhqfxavzlc743vug0jdk8lra0v5zfshfk33tgh90frc6ynwqjd6c9l3atzesqljg09',
  // Discoin Rewards wallet (funds us)
  'addr1xy37w4aqgukmhljn229a4m0ccsk3y49x40tfrnj3u8gw96pruat6q3edh0l9x55tmtkl33pdzf22d27kj889rcwsut5qaa2r64',
  // Vending Machine wallet(s)
  'stake1uyq4g3vqed986la2h7ywavup76xjr0kpfew30u99quw6w4qjxjucm',
  'addr1q83r3xqr4teazjd9z0qd8z8r9a9qslwpm6g9ugz3tu0j7mxjj9djsz0020h68nz3rxknzdh93nryqzhq6h9z0nnzf0rsc4p3x5',
  'stake1u8ffzkegp8h48mare3g3ntf3xmjce3jqptsdtj38ee3yh3c9t4uum',
  // JPG Store Contract
  'addr1w999n67e86jn6xal07pzxtrmqynspgx0fwmcmpua4wc6yzsxpljz3',
  'addr1zxj47sy4qxlktqzmkrw8dahe46gtv8seakrshsqz26qnvzypw288a4x0xf8pxgcntelxmyclq83s0ykeehchz2wtspksr3q9nx',
  // JPG Store V2 Contract
  'addr1zxgx3far7qygq0k6epa0zcvcvrevmn0ypsnfsue94nsn3tvpw288a4x0xf8pxgcntelxmyclq83s0ykeehchz2wtspks905plm',
  // Minswap Pool Contract
  'addr1z8snz7c4974vzdpxu65ruphl3zjdvtxw8strf2c2tmqnxz2j2c79gy9l76sdg0xwhd7r0c0kna0tycz4y5s6mlenh8pq0xmsha',
  // Minswap Order Contract
  'addr1wxn9efv2f6w82hagxqtn62ju4m293tqvw0uhmdl64ch8uwc0h43gt',
  'addr1zxn9efv2f6w82hagxqtn62ju4m293tqvw0uhmdl64ch8uw6j2c79gy9l76sdg0xwhd7r0c0kna0tycz4y5s6mlenh8pq6s3z70',
  // Unknown
  'addr1w9yr0zr530tp9yzrhly8lw5upddu0eym3yh0mjwa0qlr9pgmkzgv0'
]

interface assetType {
  [key: string]: {
    name: string,
    reward_ratio: number
  }
}

const ASSET_TYPES: assetType = {
  [DISCO_NFT_POLICY_ID]: {
    name: 'Disco Solaris NFT',
    reward_ratio: 0.3
  },
  [DISCO_TOKEN_POLICY_ID]: {
    'name': 'discoin',
    'reward_ratio': 0.7,
  }
}

const getPolicyAddressList = async (assetPolicy: string): Promise<any[]> => {
  if (flags.local) {
    const data = JSON.parse(Deno.readTextFileSync(`policy/${assetPolicy}.json`))
    return data
  }
  const kupoUrl = Deno.env.get(`KUPO_URL`)
  const dmtrApiKey = Deno.env.get(`DMTR_API_KEY`)

  if (!kupoUrl || !dmtrApiKey) {
    throw new Error("Unable to get env vars")
  }

  try {
    const response = await fetch(`${kupoUrl}/matches/${assetPolicy}.*?order=oldest_first&unspent`, {
      headers: {
        'dmtr-api-key': dmtrApiKey
      }
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error("An error occurred while fetching data", data)
    }
    if (flags.save) {
      try {
        Deno.mkdirSync('policy')
      } catch (error) {
        if (error?.code !== "EEXIST") {
          throw new Error("An error occurred while creating debug dir")
        }
      }
      Deno.writeTextFile(`policy/${assetPolicy}.json`, JSON.stringify(data, null, 2))
    }
    return data
  } catch (error) {
    throw new Error("An error occurred while fetching data", error)
  }
}

export const main = async () => {
  console.log("INFO: Starting snapshot")

  const assetTotals: { [policyId: string]: number } = {};
  const assetTotalsByAddress: { [address: string]: { [policyId: string]: number } } = {};

  for (const policyId in ASSET_TYPES) {
    const name = ASSET_TYPES[`${policyId}` as keyof assetType].name;
    console.log(`INFO: Retrieving policy address list for policy: ${name} (${policyId})`);
    const policyAddressList = await getPolicyAddressList(policyId);
    if (flags.debug) console.log(`DEBUG: policy_address_list size=${policyAddressList.length}`);

    for (const record of policyAddressList) {
      const address = record.address;
      const assets = record.value.assets;

      if (!address || !address.startsWith('addr')) {
        if (flags.debug) console.log(`DEBUG: Removing address ${address}`)
        continue
      }

      const add = lucid.utils.getAddressDetails(address)
      if (!add.stakeCredential || !add.paymentCredential) {
        if (flags.debug) console.log(`DEBUG: Skipping address ${address}`)
        continue
      }

      const paymentAddress = lucid.utils.credentialToAddress(add.paymentCredential)
      const stakeAddress = lucid.utils.credentialToRewardAddress(add.stakeCredential)

      if ((paymentAddress && ADDRESS_BLACKLIST.includes(paymentAddress)) || (stakeAddress && ADDRESS_BLACKLIST.includes(stakeAddress)) || ADDRESS_BLACKLIST.includes(address)) {
        if (flags.debug) console.log(`DEBUG: Skipping blacklisted address ${address}`)
        continue
      }

      if (add.paymentCredential?.type === "Script" || add.stakeCredential?.type === "Script") {
        if (flags.debug) console.log(`DEBUG: Skipping script address ${address}`)
        continue
      }

      for (const [asset, value] of Object.entries(assets)) {
        if (asset.startsWith(policyId)) {
          if (!assetTotals[policyId]) assetTotals[policyId] = 0;
          assetTotals[policyId] += value as number;

          if (!assetTotalsByAddress[address]) assetTotalsByAddress[address] = {};
          if (!assetTotalsByAddress[address][policyId]) assetTotalsByAddress[address][policyId] = 0;
          assetTotalsByAddress[address][policyId] += value as number
        }
      }
    }
    console.log(`INFO: Found ${assetTotals[policyId]} assets (${policyId}) on ${Object.keys(assetTotalsByAddress).length} addresses`);
  }

  if (!isDenoDeploy) {
    try {
      Deno.mkdirSync('debug')
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw new Error("An error occurred while creating debug dir")
      }
    }
  }


  if (flags.debug && !isDenoDeploy) {
    Deno.writeTextFileSync('debug/assetTotals.json', JSON.stringify(assetTotals, null, 2))
    Deno.writeTextFileSync('debug/assetTotalsByAddress.json', JSON.stringify(assetTotalsByAddress, null, 2))
  }

  //* Start rewards calculations
  const rewardsByPolicy: { [policyId: string]: number } = {};
  const rewardsByAddress: { [address: string]: number } = {};
  const rewardsByStakeAddress: { [stakeAddress: string]: number } = {};

  for (const policyId in ASSET_TYPES) {
    if (flags.debug) console.log(`DEBUG: Calculating rewards per asset for policy ID: (${policyId})`);
    const rewardPerAsset = REWARD_TOTAL * ASSET_TYPES[policyId].reward_ratio / assetTotals[policyId];
    if (flags.debug) console.log(`DEBUG: rewards per asset for policy ID ${policyId}: ${rewardPerAsset}`);
    rewardsByPolicy[policyId] = rewardPerAsset;
  }

  const addressInfo: string[] = [];

  for (const address in assetTotalsByAddress) {
    addressInfo.push(address);
    for (const policyId in assetTotalsByAddress[address]) {
      if (!rewardsByAddress[address]) rewardsByAddress[address] = 0;
      rewardsByAddress[address] += assetTotalsByAddress[address][policyId] * rewardsByPolicy[policyId];
    }
  }

  if (flags.debug && !isDenoDeploy) Deno.writeTextFileSync("debug/rewardsByAddress.json", JSON.stringify(rewardsByAddress, null, 2))

  for (const address of addressInfo) {
    const add = lucid.utils.getAddressDetails(address)
    const sa = lucid.utils.credentialToRewardAddress(add.stakeCredential!)
    if (!rewardsByStakeAddress[sa]) rewardsByStakeAddress[sa] = 0
    rewardsByStakeAddress[sa] += parseFloat(rewardsByAddress[address].toFixed(8));
  }

  if (!isDenoDeploy) Deno.writeTextFileSync('rewardsByStakeAddress.json', JSON.stringify(rewardsByStakeAddress, null, 2))

  const dbData: { stake: string, reward: number }[] = Object.entries(rewardsByStakeAddress).map(([key, value]) => {
    return { stake: key, reward: parseFloat(value.toFixed(1)) }
  })

  const { error: dropError } = await supabase
    .from(Deno.env.get(`DB_TABLE_REWARDS_BY_STAKE`)!)
    .delete()
    .neq(`stake`, 0)

  if (dropError) {
    console.error('ERROR: dropping table:', dropError);
  }

  const { data, error } = await supabase
    .from(Deno.env.get(`DB_TABLE_REWARDS_BY_STAKE`)!)
    .upsert(dbData);

  if (error) {
    console.error('ERROR: inserting data:', error);
  } else {
    console.log('INFO: Data inserted successfully:', data);
  }

  console.log("INFO: Finished snapshot")
}

await main()