// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract BoutEscrow {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public judge;
    address public protocolTreasury;

    struct Battle {
        address agentA;
        address agentB;
        uint256 totalWager;
        bool settled;
    }

    mapping(bytes32 => Battle) public battles;

    event DepositRecorded(bytes32 indexed battleId, address indexed agent, uint256 amount);
    event Settled(bytes32 indexed battleId, address indexed winner, uint256 winnerAmount, uint256 protocolFee);
    event Refunded(bytes32 indexed battleId, uint256 amount);

    modifier onlyJudge() {
        require(msg.sender == judge, "Only judge");
        _;
    }

    constructor(address _usdc, address _judge, address _treasury) {
        usdc = IERC20(_usdc);
        judge = _judge;
        protocolTreasury = _treasury;
    }

    function recordDeposit(
        bytes32 battleId,
        address agent,
        uint256 amount
    ) external onlyJudge {
        Battle storage b = battles[battleId];
        if (b.agentA == address(0)) {
            b.agentA = agent;
        } else {
            require(b.agentB == address(0), "Battle full");
            b.agentB = agent;
        }
        b.totalWager += amount;
        emit DepositRecorded(battleId, agent, amount);
    }

    function settle(
        bytes32 battleId,
        address winner,
        uint16 feeBps
    ) external onlyJudge {
        Battle storage b = battles[battleId];
        require(!b.settled, "Already settled");
        require(b.totalWager > 0, "No wager");
        b.settled = true;

        uint256 protocolFee = (b.totalWager * feeBps) / 10000;
        uint256 prize = b.totalWager - protocolFee;

        if (winner == address(0)) {
            // Draw: refund each half
            uint256 half = b.totalWager / 2;
            usdc.safeTransfer(b.agentA, half);
            usdc.safeTransfer(b.agentB, b.totalWager - half);
        } else {
            usdc.safeTransfer(winner, prize);
        }

        if (protocolFee > 0) {
            usdc.safeTransfer(protocolTreasury, protocolFee);
        }

        emit Settled(battleId, winner, prize, protocolFee);
    }

    function refund(bytes32 battleId) external onlyJudge {
        Battle storage b = battles[battleId];
        require(!b.settled, "Already settled");
        b.settled = true;

        if (b.agentA != address(0) && b.totalWager > 0) {
            usdc.safeTransfer(b.agentA, b.totalWager);
        }
        emit Refunded(battleId, b.totalWager);
    }

    function updateJudge(address _judge) external onlyJudge {
        judge = _judge;
    }
}
