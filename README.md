# dis-snapshot

This script will use a Kupo instace to take a snapshot of all the DIS token and DISCO NFT holders, then calculate the rewards based on the tokenomics mentioned [here](https://github.com/jaelcartel/discoin).

## How to use

Make sure to have deno installed and your env vars set, the script is using Demeter but feel free to use any Kupo instance/provider.

To execute
```
deno run --allow-all snapshot.ts
```
then all the rewards calculated will be saved inside `rewardsByStakeAddress.json`

## Script options 

use `--debug` to log more info and other details inside the `debug` dir.
use `--save` to save the snapshot files inside a `policy` dir, so they could be reused later using the option `--local`, might be helpful when testing and you want to skip calling Kupo everytime which might take a while.
