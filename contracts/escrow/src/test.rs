#![cfg(test)]

extern crate std;

use soroban_sdk::{
    testutils::Address as _,
    Address, Env, token,
};

use crate::{Escrow, EscrowClient, EscrowStatus};

// ── Helpers ──────────────────────────────────────────────────────────────

fn create_env_and_token() -> (Env, Address, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let buyer       = Address::generate(&env);
    let seller      = Address::generate(&env);
    let treasury    = Address::generate(&env);
    let token_admin = Address::generate(&env);

    // Create a Stellar asset contract token; use StellarAssetClient to mint
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let sac = token::StellarAssetClient::new(&env, &token_id);
    sac.mint(&buyer, &10_000_i128);

    let escrow_id = env.register(Escrow, ());

    (env, escrow_id, buyer, seller, treasury, token_id)
}

// ── Tests ─────────────────────────────────────────────────────────────────

/// Test 1: init sets status to Created
#[test]
fn test_init_sets_status_created() {
    let (env, escrow_id, buyer, seller, treasury, token_id) = create_env_and_token();
    let client = EscrowClient::new(&env, &escrow_id);

    client.init(&buyer, &seller, &500_i128, &token_id, &treasury);

    assert_eq!(client.get_status(), EscrowStatus::Created);
    assert_eq!(client.get_amount(), 500_i128);
}

/// Test 2: fund transitions Created → Funded and transfers tokens
#[test]
fn test_fund_transfers_tokens_and_sets_funded() {
    let (env, escrow_id, buyer, seller, treasury, token_id) = create_env_and_token();
    let client = EscrowClient::new(&env, &escrow_id);
    let token_client = token::Client::new(&env, &token_id);

    client.init(&buyer, &seller, &200_i128, &token_id, &treasury);

    let buyer_before    = token_client.balance(&buyer);
    let contract_before = token_client.balance(&escrow_id);

    client.fund();

    assert_eq!(client.get_status(), EscrowStatus::Funded);
    assert_eq!(token_client.balance(&buyer),     buyer_before - 200);
    assert_eq!(token_client.balance(&escrow_id), contract_before + 200);
}

/// Test 3: mark_shipped transitions Funded → Shipped
#[test]
fn test_mark_shipped_after_funded() {
    let (env, escrow_id, buyer, seller, treasury, token_id) = create_env_and_token();
    let client = EscrowClient::new(&env, &escrow_id);

    client.init(&buyer, &seller, &100_i128, &token_id, &treasury);
    client.fund();
    client.mark_shipped();

    assert_eq!(client.get_status(), EscrowStatus::Shipped);
}

/// Test 4: dispute transitions Funded → Disputed
#[test]
fn test_dispute_from_funded_state() {
    let (env, escrow_id, buyer, seller, treasury, token_id) = create_env_and_token();
    let client = EscrowClient::new(&env, &escrow_id);

    client.init(&buyer, &seller, &100_i128, &token_id, &treasury);
    client.fund();
    client.dispute(&buyer);

    assert_eq!(client.get_status(), EscrowStatus::Disputed);
}

/// Test 5: double-init panics
#[test]
#[should_panic(expected = "Escrow already initialised")]
fn test_double_init_panics() {
    let (env, escrow_id, buyer, seller, treasury, token_id) = create_env_and_token();
    let client = EscrowClient::new(&env, &escrow_id);

    client.init(&buyer, &seller, &100_i128, &token_id, &treasury);
    client.init(&buyer, &seller, &100_i128, &token_id, &treasury);
}

/// Test 6: fund in wrong state panics
#[test]
#[should_panic(expected = "Escrow must be in Created state to fund")]
fn test_fund_wrong_state_panics() {
    let (env, escrow_id, buyer, seller, treasury, token_id) = create_env_and_token();
    let client = EscrowClient::new(&env, &escrow_id);

    client.init(&buyer, &seller, &100_i128, &token_id, &treasury);
    client.fund();
    client.fund(); // second fund should panic
}
