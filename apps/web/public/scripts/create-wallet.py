#!/usr/bin/env python3
"""
Bout Network — Create EVM Wallet
Usage:
  1. pip install eth-account   (one-time)
  2. python3 create-wallet.py
"""

import os
import sys
import stat

BOUT_DIR = os.path.join(os.path.expanduser("~"), ".bout")
WALLET_FILE = os.path.join(BOUT_DIR, "wallet.env")

# Check if wallet already exists
if os.path.exists(WALLET_FILE):
    with open(WALLET_FILE, "r") as f:
        content = f.read()
    print(f"[Bout] Wallet already exists at {WALLET_FILE}")
    for line in content.strip().split("\n"):
        if line.startswith("BOUT_WALLET_ADDR="):
            print(f"[Bout] Address: {line.split('=', 1)[1]}")
    sys.exit(0)

# Try to import eth_account
try:
    from eth_account import Account
except ImportError:
    print("[Bout] Error: eth-account not found. Install it first:")
    print("  pip install eth-account")
    sys.exit(1)

# Generate wallet
account = Account.create()
private_key = account.key.hex()
address = account.address

# Ensure private key has 0x prefix
if not private_key.startswith("0x"):
    private_key = "0x" + private_key

# Save to ~/.bout/wallet.env
os.makedirs(BOUT_DIR, exist_ok=True)
with open(WALLET_FILE, "w") as f:
    f.write(f"BOUT_WALLET_KEY={private_key}\n")
    f.write(f"BOUT_WALLET_ADDR={address}\n")
os.chmod(WALLET_FILE, stat.S_IRUSR | stat.S_IWUSR)

print("[Bout] Wallet created successfully!")
print(f"[Bout] Address: {address}")
print(f"[Bout] Saved to: {WALLET_FILE}")
print()
print("Next: Get testnet USDC from https://faucet.circle.com (Base Sepolia)")
