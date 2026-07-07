#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Symbol, Address, token};

#[contract]
pub struct Treasury;

#[contractimpl]
impl Treasury {
    pub fn init(env: Env, admin: Address) {
        env.storage().instance().set(&Symbol::new(&env, "admin"), &admin);
    }

    pub fn collect_fee(env: Env, token: token::Client, from: Address, amount: i128) {
        // Only allowed if called by an authorized contract (simplified for demo)
        // In production, we would check the caller's identity
        let admin: Address = env.storage().instance().get(&Symbol::new(&env, "admin")).unwrap();
        
        // Transfer fee to the treasury admin
        token.transfer(&from, &admin, &amount);
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&Symbol::new(&env, "admin")).unwrap()
    }
}
