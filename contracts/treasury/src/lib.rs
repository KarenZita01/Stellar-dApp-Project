#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, Symbol, token,
};

// ── Storage keys ──────────────────────────────────────────────────────────

const KEY_ADMIN: Symbol     = symbol_short!("admin");
const KEY_TOTAL: Symbol     = symbol_short!("total");

// ── Data types ────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub struct FeeRecord {
    pub from: Address,
    pub amount: i128,
}

// ── Contract ──────────────────────────────────────────────────────────────

#[contract]
pub struct Treasury;

#[contractimpl]
impl Treasury {
    /// Initialise the treasury with an admin address.
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&KEY_ADMIN) {
            panic!("Treasury already initialised");
        }
        admin.require_auth();
        env.storage().instance().set(&KEY_ADMIN, &admin);
        env.storage().instance().set(&KEY_TOTAL, &0_i128);
        env.events().publish((symbol_short!("treasury"), symbol_short!("init")), (admin,));
    }

    /// Called by the Escrow contract to deposit the platform fee.
    /// The `from` address must have already approved this contract to spend `amount`.
    pub fn collect_fee(env: Env, token_address: Address, from: Address, amount: i128) {
        if amount <= 0 {
            panic!("Fee amount must be positive");
        }

        let token = token::Client::new(&env, &token_address);
        token.transfer(&from, &env.current_contract_address(), &amount);

        // Accumulate total fees
        let total: i128 = env.storage().instance().get(&KEY_TOTAL).unwrap_or(0);
        env.storage().instance().set(&KEY_TOTAL, &(total + amount));

        // Emit event
        env.events().publish(
            (symbol_short!("treasury"), symbol_short!("fee")),
            (from, amount),
        );
    }

    /// Admin-only: withdraw accumulated fees to a recipient address.
    pub fn withdraw(env: Env, token_address: Address, to: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&KEY_ADMIN).unwrap();
        admin.require_auth();

        let token = token::Client::new(&env, &token_address);
        token.transfer(&env.current_contract_address(), &to, &amount);

        let total: i128 = env.storage().instance().get(&KEY_TOTAL).unwrap_or(0);
        env.storage().instance().set(&KEY_TOTAL, &(total - amount));

        env.events().publish(
            (symbol_short!("treasury"), symbol_short!("withdraw")),
            (to, amount),
        );
    }

    /// Return the current admin.
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&KEY_ADMIN).unwrap()
    }

    /// Return total fees collected (lifetime).
    pub fn get_total_fees(env: Env) -> i128 {
        env.storage().instance().get(&KEY_TOTAL).unwrap_or(0)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod test;
