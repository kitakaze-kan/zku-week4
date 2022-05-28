import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers, Contract, ethers, utils } from "ethers"
import Head from "next/head"
import React, { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import styles from "../styles/Home.module.css"
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from "yup";
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json";

type InputForm = {
    name: string
    age: number
    address: string
    greet: string
}

const abi = [
    "event NewGreeting(bytes32 greeting)"
  ];

export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    const [contract, setContract] = useState<Contract>()
    const [greeting, setGreeting] = useState<string | undefined>()

    const schema = yup.object({
        name: yup.string().required("Please enter this"),
        age: yup.number().positive().integer().nullable(),
        address: yup.string().max(42, "only allowed less than 42 characters"),
        greet: yup.string().required("Please enter this"),

    }).required();

    useEffect(() => {
        const listener = async () => {
            console.log("listener started...")
            const provider = (await detectEthereumProvider()) as any
            const ethersProvider = new providers.Web3Provider(provider)
            const contract = new Contract(
                "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
                Greeter.abi,
                ethersProvider
            );
            setContract(contract)
            contract.on("NewGreeting", (greeting) => {
                console.log(`greeting: ${greeting}`)
                console.log(`greeting: ${utils.parseBytes32String(greeting)}`)
                setGreeting(utils.parseBytes32String(greeting))
            })
          }
          
          listener()

        return () => {
            console.log("removeAllListeners")
            contract?.removeAllListeners();
        };
    },[])

    const {
        register,
        handleSubmit,
        formState: { errors },
      } = useForm<InputForm>({
        resolver: yupResolver(schema),
        defaultValues: {
            name: "", age: 0, address: "", greet: ""
        }
      });

    async function greet(greet: string) {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any
        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()

        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = greet

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        console.log({response})

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }

    const onSubmit = (data: InputForm) => {
        console.log("data", data)
        if(!data.greet) return
        greet(data.greet)

      };

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>
                <div className="card w-1/2 bg-base-100 shadow-xl">
                    <div className="card-body">
                        <form onSubmit={handleSubmit(onSubmit)} className="w-full text-base">
                            <div className="w-full">
                                <label >name</label>
                                <input
                                    className="w-full my-1 py-2 px-6 border rounded-full shadow-xl text-xs md:text-sm text-black"
                                    {...register("name")}
                                />
                                <span className="cols-span-1 px-3 text-xs text-red-600">
                                    {errors.name && errors.name.message}
                                </span>
                            </div>
                            <div className="w-full">
                                <label >address</label>
                                <input
                                    className="w-full my-1 py-2 px-6 border rounded-full shadow-xl text-xs md:text-sm text-black"
                                    {...register("address")}
                                />
                                <span className="cols-span-1 px-3 text-xs text-red-600">
                                    {errors.address && errors.address.message}
                                </span>
                            </div>
                            <div className="w-full">
                                <label >age</label>
                                <input
                                    className="w-full my-1 py-2 px-6 border rounded-full shadow-xl text-xs md:text-sm text-black"
                                    {...register("age")}
                                />
                                <span className="cols-span-1 px-3 text-xs text-red-600">
                                    {errors.age && errors.age.message}
                                </span>
                            </div>
                            <div className="w-full">
                                <label >greet</label>
                                <input
                                    className="w-full my-1 py-2 px-6 border rounded-full shadow-xl text-xs md:text-sm text-black"
                                    {...register("greet")}
                                />
                                <span className="cols-span-1 px-3 text-xs text-red-600">
                                    {errors.greet && errors.greet.message}
                                </span>
                            </div>
                            <div className="w-full text-center">
                                <div className={styles.logs}>{logs}</div>
                                <button type="submit" className="btn bg-primary">
                                    Greet
                                </button>
                            </div>
                        </form>
                        <div className="w-full text-center pt-4">
                            <textarea className="textarea textarea-success w-full" placeholder="you say nothing yet" value={greeting} readOnly></textarea>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
