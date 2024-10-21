/* eslint-disable fp/no-loops, fp/no-mutation, fp/no-mutating-methods, fp/no-let, no-constant-condition */

import { program } from "commander";
import {
  getProof,
  formatBig,
  runner,
  submitProof,
  MineEvent,
  getOrCreateMiner,
  fetchBus,
  CONFIG,
} from "../common";
import { Config, MINE } from "../codegen/mineral/mine/structs";
import { Miner } from "../codegen/mineral/miner/structs";
import { decodeSuiPrivateKey } from "@mysten/sui.js/cryptography";
import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { SUI_TYPE_ARG, SUI_DECIMALS } from "@mysten/sui.js/utils";
import chalk from "chalk";

const { WALLET, RPC } = process.env;
//const { RPC } = process.env;

//const WALLET = "suiprivkey1qz07gnr9rwveu3nnsk72hcaxhdxdxrp95jcw94a53qrp59mszp6nx8at84e"

const START_TIME = 1715534935000;
const USAGE_GUIDE =
  "https://github.com/ronanyeah/mineral-app/blob/master/cli/README.md";
const SETUP_PROMPT =
  "Wallet not found. Consult the setup guide: " + USAGE_GUIDE;

const settings = (() => {
  return {
    wallet: (() => {
      if (!WALLET) {
        return null;
      }
      return Ed25519Keypair.fromSecretKey(
        decodeSuiPrivateKey(WALLET).secretKey
      );
    })(),
    rpc: new SuiClient({
      url: RPC || getFullnodeUrl("mainnet"),
    }),
  };
})();

program
  .name("mineral")
  .description("Mineral CLI Miner\nhttps://mineral.supply/")
  .version("1.0.0");

program
  .command("profile")
  .description("View your mining stats")
  .action((_options) =>
    (async () => {
      if (!settings.wallet) {
        return program.error(SETUP_PROMPT);
      }
      const pub = settings.wallet.toSuiAddress();
      console.log(chalk.green("Wallet:"), pub);
      const minerAcct = await getProof(settings.rpc, pub);
      if (minerAcct) {
        console.log(chalk.green("Miner:"), minerAcct);
      }
      const results = await Promise.all([
        (async () => {
          const bal = await settings.rpc.getBalance({
            owner: pub,
            coinType: SUI_TYPE_ARG,
          });
          const val = formatBig(BigInt(bal.totalBalance), SUI_DECIMALS);
          return [`💧 Sui Balance: ${val} SUI`];
        })(),
        (async () => {
          const bal = await settings.rpc.getBalance({
            owner: pub,
            coinType: MINE.$typeName,
          });
          const val = formatBig(BigInt(bal.totalBalance), SUI_DECIMALS);
          return [`⛏️  Mineral Balance: ${val} $MINE`];
        })(),
        (async () => {
          const proof = await getProof(settings.rpc, pub);
          if (!proof) {
            return [];
          }
          const miner = await Miner.fetch(settings.rpc, proof);
          return [
            `💰 Lifetime rewards: ${formatBig(miner.totalRewards, 9)} $MINE`,
            `🏭 Lifetime hashes: ${miner.totalHashes}`,
          ];
        })(),
      ]);
      results.flat().forEach((val) => console.log(val));
    })().catch(console.error)
  );

program
  .command("stats")
  .description("View global Mineral stats")
  .action((_options) =>
    (async () => {
      const config = await Config.fetch(settings.rpc, CONFIG);
      const bus = await fetchBus(settings.rpc);
      console.log(
        "Total distributed rewards:",
        Number(config.totalRewards) / 1_000_000_000,
        "$MINE"
      );
      console.log("Total hashes processed:", Number(config.totalHashes));
      console.log(
        "Current reward rate:",
        Number(bus.rewardRate) / 1_000_000_000,
        "$MINE / hash"
      );
      console.log("Current difficulty:", bus.difficulty);
    })().catch(console.error)
  );

program
  .command("create-wallet")
  .description("Create a new Sui wallet")
  .action(async (_options) => {
    const wallet = new Ed25519Keypair();
    console.log(chalk.green("Wallet created:"), wallet.toSuiAddress());
    console.log(chalk.red("Private key:"), wallet.getSecretKey());
    console.log(chalk.blue("Mineral CLI usage guide:"), USAGE_GUIDE);
  });

program
  .command("mine")
  .description("Start mining ⛏️")
  .action((_options) =>
    (async () => {
      if (!settings.wallet) {
        return program.error(SETUP_PROMPT);
      }
      const bal = await settings.rpc.getBalance({
        owner: settings.wallet.toSuiAddress(),
        coinType: SUI_TYPE_ARG,
      });
      if (Number(bal.totalBalance) < 0.1) {
        console.log(
          chalk.red("Low balance"),
          "in wallet",
          settings.wallet.toSuiAddress()
        );
        console.log("Send some SUI to this wallet to enable mining.");
      }

      if (Date.now() < START_TIME) {
        return program.error("⚠️  Mining has not started yet!");
      }

      console.error(
        chalk.green("Mining with wallet:"),
        settings.wallet.toSuiAddress()
      );
      // This is just a string
      const minerAccount = await getOrCreateMiner(
        settings.wallet,
        settings.rpc
      );
      console.log("minerAccount: " + minerAccount);
      const bus = await fetchBus(settings.rpc);
      console.log(bus);
      

      console.log("args: " + program.args);
      var startNonce = 0
      if (program.args.length > 1) {
        console.log("args[1]: " + program.args[1]);
        startNonce = BigInt(parseInt(program.args[1]))
      }
      

      if (!minerAccount) {
        return program.error("Miner account not created!");
      }
      //console.log(settings.rpc);
      console.log("diff: " + bus.difficulty);
      console.log("wallet: " + settings.wallet);
      console.log("minerAccount: " + minerAccount);
      console.log("startNonce: " + startNonce)
      runner(
        settings.rpc,
        bus.difficulty,
        settings.wallet,
        minerAccount,
        startNonce,
        console.log
      );
    })().catch(console.error)
  );


  program
  .command("submit")
  //.description("Start mining ⛏️")
  .action((_options) =>
    (async () => {
      if (!settings.wallet) {
        return program.error(SETUP_PROMPT);
      }
      const bal = await settings.rpc.getBalance({
        owner: settings.wallet.toSuiAddress(),
        coinType: SUI_TYPE_ARG,
      });
      if (Number(bal.totalBalance) < 0.1) {
        console.log(
          chalk.red("Low balance"),
          "in wallet",
          settings.wallet.toSuiAddress()
        );
        console.log("Send some SUI to this wallet to enable mining.");
      }

      if (Date.now() < START_TIME) {
        return program.error("⚠️  Mining has not started yet!");
      }

      console.error(
        chalk.green("Mining with wallet:"),
        settings.wallet.toSuiAddress()
      );
      // This is just a string
      const minerAccount = await getOrCreateMiner(
        settings.wallet,
        settings.rpc
      );
      console.log("minerAccount: " + minerAccount);
      const bus = await fetchBus(settings.rpc);
      console.log(bus);
      

      console.log("args: " + program.args);
      var submitNonce = BigInt(0)
      if (program.args.length > 1) {
        console.log("args[1]: " + program.args[1]);
        submitNonce = BigInt(parseInt(program.args[1]))
      }

      if (!minerAccount) {
        return program.error("Miner account not created!");
      }

      console.log("submitNonce: " + submitNonce)


      
      const handleEvent = (ev: MineEvent) => {
        switch (ev) {
          case "resetting": {
            break;
          }
          case "retrying": {
            break;
          }
          case "submitting": {
            console.log("✅ Valid hash found");
            console.log("📡 Submitting transaction");
            break;
          }
          case "simulating": {
            break;
          }
        }
      };

      const res = await submitProof(
        settings.wallet,
        submitNonce,
        settings.rpc,
        minerAccount,
        handleEvent
      );

      if (!res) {
        console.log("Somethign went wrong");
        console.log(res);
        //return 1;
        return process.exit(1)
      }

      console.log("🏅 Mining success!");
      console.log("🔍 Looking for next hash...");

      /*
      //console.log(settings.rpc);
      console.log("diff: " + bus.difficulty);
      console.log("wallet: " + settings.wallet);
      console.log("minerAccount: " + minerAccount);
      console.log("startNonce: " + startNonce)
      runner(
        settings.rpc,
        bus.difficulty,
        settings.wallet,
        minerAccount,
        startNonce,
        console.log
      );
      */
    })().catch(console.error)
  );


  /*
          const handleEvent = (ev: MineEvent) => {
          switch (ev) {
            case "resetting": {
              break;
            }
            case "retrying": {
              break;
            }
            case "submitting": {
              log("✅ Valid hash found");
              log("📡 Submitting transaction");
              break;
            }
            case "simulating": {
              break;
            }
          }
        };
        const dataToHash = new Uint8Array(32 + 32 + 8);
        dataToHash.set(currentHash, 0);
        dataToHash.set(signerBytes, 32);
        //console.log("nonce: " + nonce);
        //console.log("int64to8: " + int64to8(nonce));
        dataToHash.set(int64to8(nonce), 64);
        var str1 = "dataToHash = 0x"; 
        for(var x = 0; x < 72; ++x) {
          str1 += dataToHash[x].toString(16).padStart(2, '0');
        }
        console.log(str1);

        var str2 = "result = 0x"; 
        for(var x = 0; x < 32; x++) {
          str2 += hash_result[x].toString(16).padStart(2, '0');
        }
        console.log(str2);

        console.log("Nonce: " + nonce);
        console.log("minerID: " + minerId);
        console.log("wallet: " + wallet);
        const res = await submitProof(
          wallet,
          nonce,
          client,
          minerId,
          handleEvent
        );

        if (!res) {
          return;
        }

        log("🏅 Mining success!");
        log("🔍 Looking for next hash...");
  */

program.parse(process.argv);
