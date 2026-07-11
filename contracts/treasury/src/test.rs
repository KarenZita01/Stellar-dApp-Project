#![cfg(test)]

extern crate std;

use soroban_sdk::{
    testutils::Address as _,
    Address, Env, token,
};

use crate::{Treasury, TreasuryClient};

// ── Helpers ──────────────────────────────────────────────────────────────

fn setup_env() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    // Allow non-root auth so that token.transfer() inside collect_fee
    // (a sub-contract call) is also mocked correctly.
    env.mock_all_auths_allowing_non_root_auth();

    let admin     = Address::generate(&env);
    let depositor = Address::generate(&env);

    // Create token; use StellarAssetClient (admin interface) to mint
    let token_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let sac = token::StellarAssetClient::new(&env, &token_id);
    sac.mint(&depositor, &5_000_i128);

    let treasury_id = env.register(Treasury, ());

    (env, treasury_id, admin, depositor, token_id)
}

// ── Tests ─────────────────────────────────────────────────────────────────

/// Test 1: init stores admin correctly
#[test]
fn test_init_stores_admin() {
    let (env, treasury_id, admin, _depositor, _token_id) = setup_env();
    let client = TreasuryClient::new(&env, &treasury_id);

    client.init(&admin);

    assert_eq!(client.get_admin(), admin);
}

/// Test 2: total fees start at zero after init
#[test]
fn test_initial_total_fees_zero() {
    let (env, treasury_id, admin, _depositor, _token_id) = setup_env();
    let client = TreasuryClient::new(&env, &treasury_id);

    client.init(&admin);

    assert_eq!(client.get_total_fees(), 0_i128);
}

/// Test 3: collect_fee transfers tokens and increments total
#[test]
fn test_collect_fee_increments_total() {
    let (env, treasury_id, admin, depositor, token_id) = setup_env();
    let client = TreasuryClient::new(&env, &treasury_id);
    let token_client = token::Client::new(&env, &token_id);

    client.init(&admin);

    let depositor_before = token_client.balance(&depositor);
    client.collect_fee(&token_id, &depositor, &10_i128);

    assert_eq!(client.get_total_fees(), 10_i128);
    assert_eq!(token_client.balance(&depositor),   depositor_before - 10);
    assert_eq!(token_client.balance(&treasury_id), 10_i128);
}

/// Test 4: multiple fees accumulate correctly
#[test]
fn test_multiple_fees_accumulate() {
    let (env, treasury_id, admin, depositor, token_id) = setup_env();
    let client = TreasuryClient::new(&env, &treasury_id);

    client.init(&admin);
    client.collect_fee(&token_id, &depositor, &100_i128);
    client.collect_fee(&token_id, &depositor, &50_i128);
    client.collect_fee(&token_id, &depositor, &25_i128);

    assert_eq!(client.get_total_fees(), 175_i128);
}

/// Test 5: admin can withdraw accumulated fees
#[test]
fn test_admin_can_withdraw() {
    let (env, treasury_id, admin, depositor, token_id) = setup_env();
    let client = TreasuryClient::new(&env, &treasury_id);
    let token_client = token::Client::new(&env, &token_id);

    client.init(&admin);
    client.collect_fee(&token_id, &depositor, &200_i128);

    let admin_before = token_client.balance(&admin);
    client.withdraw(&token_id, &admin, &200_i128);

    assert_eq!(client.get_total_fees(), 0_i128);
    assert_eq!(token_client.balance(&admin), admin_before + 200);
}

/// Test 6: double-init panics
#[test]
#[should_panic(expected = "Treasury already initialised")]
fn test_double_init_panics() {
    let (env, treasury_id, admin, _depositor, _token_id) = setup_env();
    let client = TreasuryClient::new(&env, &treasury_id);

    client.init(&admin);
    client.init(&admin);
}
