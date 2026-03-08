// ============================================================
//  CIPHER — Models
// ============================================================

pub const STATUS_LOBBY: u8 = 0;
pub const STATUS_PLACING: u8 = 1;
pub const STATUS_ACTIVE: u8 = 2;
pub const STATUS_FINISHED: u8 = 3;

pub const RANK_FLAG: u8 = 0;
pub const RANK_SPY: u8 = 1;
pub const RANK_SCOUT: u8 = 2;
pub const RANK_MINER: u8 = 3;
pub const RANK_CAPTAIN: u8 = 6;
pub const RANK_MAJOR: u8 = 7;
pub const RANK_COLONEL: u8 = 8;
pub const RANK_GENERAL: u8 = 9;
pub const RANK_MARSHAL: u8 = 10;
pub const RANK_BOMB: u8 = 11;

pub const PIECES_PER_PLAYER: u8 = 10;
pub const BOARD_SIZE: u8 = 10;
pub const P1_MAX_ROW: u8 = 3;
pub const P2_MIN_ROW: u8 = 6;
pub const EMPTY_SQUARE: u8 = 255;

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct Game {
    #[key]
    pub game_id: felt252,
    pub player1: starknet::ContractAddress,
    pub player2: starknet::ContractAddress,
    pub current_turn: starknet::ContractAddress,
    pub status: u8,
    pub winner: starknet::ContractAddress,
    pub turn_count: u32,
    pub p1_pieces_placed: u8,
    pub p2_pieces_placed: u8,
    pub created_at: u64,
}

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct GameCounter {
    #[key]
    pub id: felt252,
    pub count: felt252,
}

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct PlayerGame {
    #[key]
    pub player: starknet::ContractAddress,
    pub game_id: felt252,
}

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct Piece {
    #[key]
    pub game_id: felt252,
    #[key]
    pub piece_id: u8,
    pub owner: starknet::ContractAddress,
    pub x: u8,
    pub y: u8,
    pub rank_commitment: felt252,
    pub revealed_rank: u8,
    pub is_alive: bool,
    pub is_revealed: bool,
    pub is_placed: bool,
}

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct Square {
    #[key]
    pub game_id: felt252,
    #[key]
    pub x: u8,
    #[key]
    pub y: u8,
    pub piece_id: u8,
    pub is_occupied: bool,
}

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct PendingCombat {
    #[key]
    pub game_id: felt252,
    pub is_active: bool,
    pub attacker_piece_id: u8,
    pub attacker_rank: u8,
    pub defender_piece_id: u8,
    pub from_x: u8,
    pub from_y: u8,
    pub to_x: u8,
    pub to_y: u8,
}
