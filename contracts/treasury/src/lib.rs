#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Symbol, Address, token};

#[contract]
pub struct Treasury;

#[contractimpl]
impl Treasury {
    pub fn init(env: Env, admin: Address) {
        env.storage().instance().set(&Symbol::new(&env, "admin"), &admin);
    }

     pub fn collect_fee(env: Env, token_address: Address, from: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&Symbol::new(&env, "admin")).unwrap();
        let token = token::Client::from_address(&env, &token_address);
        token.transfer(&from, &admin, &amount);
    }
        
        // Transfer fee to the treasury admin
        token.transfer(&from, &admin, &amount);
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&Symbol::new(&env, "admin")).unwrap()
    }
}
