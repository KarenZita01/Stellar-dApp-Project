#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    vec, Address, Env, IntoVal, Symbol, token,
};

// ── Storage keys ──────────────────────────────────────────────────────────

const KEY_BUYER: Symbol    = symbol_short!("buyer");
const KEY_SELLER: Symbol   = symbol_short!("seller");
const KEY_AMOUNT: Symbol   = symbol_short!("amount");
const KEY_TREASURY: Symbol = symbol_short!("treasury");
const KEY_TOKEN: Symbol    = symbol_short!("token");
const KEY_STATUS: Symbol   = symbol_short!("status");

// ── State machine ─────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Copy, Eq, PartialEq, Debug)]
pub enum EscrowStatus {
    Created,
    Funded,
    Shipped,
    Completed,
    Disputed,
}

// ── Contract ──────────────────────────────────────────────────────────────

#[contract]
pub struct Escrow;

#[contractimpl]
impl Escrow {
    /// Initialise a new escrow deal.
    /// State transition: → Created
    pub fn init(
        env: Env,
        buyer: Address,
        seller: Address,
        amount: i128,
        token_address: Address,
        treasury_address: Address,
    ) {
        if env.storage().instance().has(&KEY_STATUS) {
            panic!("Escrow already initialised");
        }
        buyer.require_auth();

        env.storage().instance().set(&KEY_BUYER,    &buyer);
        env.storage().instance().set(&KEY_SELLER,   &seller);
        env.storage().instance().set(&KEY_AMOUNT,   &amount);
        env.storage().instance().set(&KEY_TOKEN,    &token_address);
        env.storage().instance().set(&KEY_TREASURY, &treasury_address);
        env.storage().instance().set(&KEY_STATUS,   &EscrowStatus::Created);

        // Emit EscrowCreated event
        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("init")),
            (buyer, seller, amount),
        );
    }

    /// Buyer transfers funds into the contract.
    /// State transition: Created → Funded
    pub fn fund(env: Env) {
        let status: EscrowStatus = env.storage().instance().get(&KEY_STATUS).unwrap();
        if status != EscrowStatus::Created {
            panic!("Escrow must be in Created state to fund");
        }

        let buyer: Address      = env.storage().instance().get(&KEY_BUYER).unwrap();
        let amount: i128        = env.storage().instance().get(&KEY_AMOUNT).unwrap();
        let token_addr: Address = env.storage().instance().get(&KEY_TOKEN).unwrap();

        buyer.require_auth();

        let token = token::Client::new(&env, &token_addr);
        token.transfer(&buyer, &env.current_contract_address(), &amount);

        env.storage().instance().set(&KEY_STATUS, &EscrowStatus::Funded);

        // Emit EscrowFunded event
        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("funded")),
            (buyer, amount),
        );
    }

    /// Seller marks the item as shipped.
    /// State transition: Funded → Shipped
    pub fn mark_shipped(env: Env) {
        let status: EscrowStatus = env.storage().instance().get(&KEY_STATUS).unwrap();
        if status != EscrowStatus::Funded {
            panic!("Escrow must be in Funded state to mark as shipped");
        }

        let seller: Address = env.storage().instance().get(&KEY_SELLER).unwrap();
        seller.require_auth();

        env.storage().instance().set(&KEY_STATUS, &EscrowStatus::Shipped);

        // Emit EscrowShipped event
        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("shipped")),
            (seller,),
        );
    }

    /// Buyer confirms delivery; pays seller and sends 1% fee to treasury.
    /// State transition: Shipped → Completed
    ///
    /// Inter-contract communication: calls `treasury::collect_fee` via
    /// `env.invoke_contract`, the standard Soroban cross-contract call approach.
    pub fn release_funds(env: Env) {
        let status: EscrowStatus = env.storage().instance().get(&KEY_STATUS).unwrap();
        if status != EscrowStatus::Shipped {
            panic!("Funds can only be released after the item is shipped");
        }

        let buyer: Address      = env.storage().instance().get(&KEY_BUYER).unwrap();
        let seller: Address     = env.storage().instance().get(&KEY_SELLER).unwrap();
        let amount: i128        = env.storage().instance().get(&KEY_AMOUNT).unwrap();
        let token_addr: Address = env.storage().instance().get(&KEY_TOKEN).unwrap();
        let treasury: Address   = env.storage().instance().get(&KEY_TREASURY).unwrap();

        buyer.require_auth();

        let token = token::Client::new(&env, &token_addr);

        // Calculate 1% fee
        let fee: i128 = amount / 100;
        let seller_amount: i128 = amount - fee;

        // Pay seller
        token.transfer(&env.current_contract_address(), &seller, &seller_amount);

        // ── Inter-contract call: pay 1% fee to Treasury ──────────────────
        // Uses env.invoke_contract — the standard Soroban cross-contract call.
        // This calls treasury.collect_fee(token_addr, from, fee)
        if fee > 0 {
            let args = vec![
                &env,
                token_addr.clone().into_val(&env),
                env.current_contract_address().into_val(&env),
                fee.into_val(&env),
            ];
            env.invoke_contract::<()>(&treasury, &Symbol::new(&env, "collect_fee"), args);
        }

        env.storage().instance().set(&KEY_STATUS, &EscrowStatus::Completed);

        // Emit EscrowCompleted event
        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("complete")),
            (buyer.clone(), seller, seller_amount),
        );
        // Emit FeePaid event
        env.events().publish(
            (symbol_short!("treasury"), symbol_short!("fee")),
            (buyer, fee),
        );
    }

    /// Either party can flag a deal as disputed.
    /// State transition: Funded | Shipped → Disputed
    pub fn dispute(env: Env, caller: Address) {
        let status: EscrowStatus = env.storage().instance().get(&KEY_STATUS).unwrap();
        if status != EscrowStatus::Funded && status != EscrowStatus::Shipped {
            panic!("Dispute can only be raised in Funded or Shipped state");
        }

        let buyer: Address  = env.storage().instance().get(&KEY_BUYER).unwrap();
        let seller: Address = env.storage().instance().get(&KEY_SELLER).unwrap();
        if caller != buyer && caller != seller {
            panic!("Only buyer or seller can raise a dispute");
        }
        caller.require_auth();

        env.storage().instance().set(&KEY_STATUS, &EscrowStatus::Disputed);

        // Emit Disputed event
        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("dispute")),
            (caller,),
        );
    }

    /// Read the current status.
    pub fn get_status(env: Env) -> EscrowStatus {
        env.storage().instance().get(&KEY_STATUS).unwrap()
    }

    /// Read the escrow amount.
    pub fn get_amount(env: Env) -> i128 {
        env.storage().instance().get(&KEY_AMOUNT).unwrap()
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod test;
