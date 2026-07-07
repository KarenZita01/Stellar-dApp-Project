#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Symbol, Address, token};

#[derive(soroban_sdk::ContractKls)]
#[derive(Clone)]
pub enum EscrowStatus {
    Created,
    Funded,
    Shipped,
    Completed,
    Disputed,
}

#[contract]
pub struct Escrow;

#[contractimpl]
impl Escrow {
    pub fn init(env: Env, buyer: Address, seller: Address, amount: i128, treasury_address: Address) {
        env.storage().instance().set(&Symbol::new(&env, "buyer"), &buyer);
        env.storage().instance().set(&Symbol::new(&env, "seller"), &seller);
        env.storage().instance().set(&Symbol::new(&env, "amount"), &amount);
        env.storage().instance().set(&Symbol::new(&env, "treasury"), &treasury_address);
        env.storage().instance().set(&Symbol::new(&env, "status"), &EscrowStatus::Created);
    }

    pub fn fund(env: Env, token: token::Client) {
        let buyer: Address = env.storage().instance().get(&Symbol::new(&env, "buyer")).unwrap();
        let amount: i128 = env.storage().instance().get(&Symbol::new(&env, "amount")).unwrap();
        
        // Buyer transfers funds to the escrow contract
        token.transfer(&buyer, &env.current_contract_address(), &amount);
        
        env.storage().instance().set(&Symbol::new(&env, "status"), &EscrowStatus::Funded);
    }

    pub fn mark_shipped(env: Env) {
        let seller: Address = env.storage().instance().get(&Symbol::new(&env, "seller")).unwrap();
        if env.auth() != seller {
            panic!("Only the seller can mark as shipped");
        }
        env.storage().instance().set(&Symbol::new(&env, "status"), &EscrowStatus::Shipped);
    }

    pub fn release_funds(env: Env, token: token::Client) {
        let buyer: Address = env.storage().instance().get(&Symbol::new(&env, "buyer")).unwrap();
        let seller: Address = env.storage().instance().get(&Symbol::new(&env, "seller")).unwrap();
        let amount: i128 = env.storage().instance().get(&Symbol::new(&env, "amount")).unwrap();
        let treasury: Address = env.storage().instance().get(&Symbol::new(&env, "treasury")).unwrap();
        let status: EscrowStatus = env.storage().instance().get(&Symbol::new(&env, "status")).unwrap();

        if env.auth() != buyer {
            panic!("Only the buyer can release funds");
        }
        if status != EscrowStatus::Shipped {
            panic!("Funds can only be released after shipping");
        }

        // Calculate 1% fee for treasury
        let fee = amount / 100;
        let seller_amount = amount - fee;

        // 1. Send fee to Treasury Contract
        // Inter-contract communication: we call a function on the treasury contract
        let treasury_client = soroban_sdk::contractclient!(Treasury);
        treasury_client.call(&env, &treasury, soroban_sdk::contractcall::Args {
            token: token.clone(),
            from: env.current_contract_address(),
            amount: fee,
        });

        // 2. Send remaining funds to seller
        token.transfer(&env.current_contract_address(), &seller, &seller_amount);
        
        env.storage().instance().set(&Symbol::new(&env, "status"), &EscrowStatus::Completed);
    }

    pub fn get_status(env: Env) -> EscrowStatus {
        env.storage().instance().get(&Symbol::new(&env, "status")).unwrap()
    }
}
