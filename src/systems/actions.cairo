// ============================================================
//  CIPHER — Actions (EGS via library functions)
//  Uses game_components library pattern from tic-tac-toe example.
//  denshokan_address stored in contract storage, set via dojo_init.
//  pre_action / post_action called as library functions.
// ============================================================

#[starknet::interface]
pub trait IActions<T> {
    fn create_game(ref self: T) -> felt252;
    fn join_game(ref self: T, game_id: felt252);
    fn place_piece(ref self: T, game_id: felt252, piece_id: u8, x: u8, y: u8, rank_commitment: felt252);
    fn ready(ref self: T, game_id: felt252);
    fn move_piece(ref self: T, game_id: felt252, piece_id: u8, to_x: u8, to_y: u8, rank: u8, salt: felt252);
    fn resolve_combat(ref self: T, game_id: felt252, piece_id: u8, rank: u8, salt: felt252);
    fn forfeit(ref self: T, game_id: felt252);
    fn claim_reward(ref self: T, game_id: felt252);
    fn create_game_egs(ref self: T, token_id: felt252) -> felt252;
}

#[dojo::contract]
pub mod actions {
    use super::IActions;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use dojo::world::WorldStorage;
    use dojo::model::ModelStorage;
    use cipher::models::{
        Game, GameCounter, PlayerGame,
        Piece, Square, PendingCombat,
        PlayerStats, RewardClaim,
        RANK_FLAG, RANK_SPY, RANK_SCOUT, RANK_MINER, RANK_MARSHAL, RANK_BOMB,
        PIECES_PER_PLAYER, BOARD_SIZE, P1_MAX_ROW, P2_MIN_ROW,
        STATUS_LOBBY, STATUS_PLACING, STATUS_ACTIVE, STATUS_FINISHED,
        POINTS_WIN, POINTS_LOSS,
    };
    use core::poseidon::poseidon_hash_span;
    // EGS library functions — multi-contract pattern
    use game_components_embeddable_game_standard::minigame::minigame::{
        pre_action, post_action,
    };

    // ── Contract storage for denshokan address ────────────
    #[storage]
    struct Storage {
        denshokan_address: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {}

    // ── dojo_init: called once by sozo migrate ────────────
    fn dojo_init(ref self: ContractState, denshokan_address: ContractAddress) {
        self.denshokan_address.write(denshokan_address);
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> WorldStorage {
            self.world(@"cipher")
        }

        fn egs_pre(self: @ContractState, game_id: felt252) {
            let addr = self.denshokan_address.read();
            let zero: ContractAddress = starknet::contract_address_const::<0>();
            if addr != zero { pre_action(addr, game_id); }
        }

        fn egs_post(self: @ContractState, game_id: felt252) {
            let addr = self.denshokan_address.read();
            let zero: ContractAddress = starknet::contract_address_const::<0>();
            if addr != zero { post_action(addr, game_id); }
        }

        fn verify_commitment(commitment: felt252, rank: u8, salt: felt252) {
            let rank_felt: felt252 = rank.into();
            let hash = poseidon_hash_span(array![rank_felt, salt].span());
            assert(hash == commitment, 'Invalid rank commitment');
        }

        fn opponent(game: @Game, player: ContractAddress) -> ContractAddress {
            if player == *game.player1 { *game.player2 } else { *game.player1 }
        }

        fn award_loss(ref world: WorldStorage, loser: ContractAddress, game_id: felt252) {
            let mut stats: PlayerStats = world.read_model(loser);
            if stats.last_session_id == game_id { return; }
            stats.losses += 1; stats.points += POINTS_LOSS; stats.last_session_id = game_id;
            world.write_model(@stats);
        }

        fn do_move(ref world: WorldStorage, game_id: felt252, piece_id: u8, from_x: u8, from_y: u8, to_x: u8, to_y: u8) {
            let mut piece: Piece = world.read_model((game_id, piece_id));
            piece.x = to_x; piece.y = to_y;
            world.write_model(@piece);
            world.write_model(@Square { game_id, x: from_x, y: from_y, piece_id: 255_u8, is_occupied: false });
            world.write_model(@Square { game_id, x: to_x, y: to_y, piece_id, is_occupied: true });
        }

        fn kill_piece(ref world: WorldStorage, game_id: felt252, piece_id: u8, x: u8, y: u8) {
            let mut piece: Piece = world.read_model((game_id, piece_id));
            piece.is_alive = false;
            world.write_model(@piece);
            world.write_model(@Square { game_id, x, y, piece_id: 255_u8, is_occupied: false });
        }

        fn clear_combat(ref world: WorldStorage, game_id: felt252) {
            world.write_model(@PendingCombat {
                game_id, is_active: false, attacker_piece_id: 0, attacker_rank: 0,
                defender_piece_id: 0, from_x: 0, from_y: 0, to_x: 0, to_y: 0,
            });
        }

        fn validate_scout_move(ref world: WorldStorage, game_id: felt252, from_x: u8, from_y: u8, to_x: u8, to_y: u8) {
            assert(from_x == to_x || from_y == to_y, 'Scout: must move in a line');
            assert(from_x != to_x || from_y != to_y, 'Scout: must move');
            if from_x == to_x {
                let (start, end) = if to_y > from_y { (from_y + 1_u8, to_y) } else { (to_y + 1_u8, from_y) };
                let mut i: u8 = start;
                while i < end { let sq: Square = world.read_model((game_id, from_x, i)); assert(!sq.is_occupied, 'Scout: path blocked'); i += 1; };
            } else {
                let (start, end) = if to_x > from_x { (from_x + 1_u8, to_x) } else { (to_x + 1_u8, from_x) };
                let mut i: u8 = start;
                while i < end { let sq: Square = world.read_model((game_id, i, from_y)); assert(!sq.is_occupied, 'Scout: path blocked'); i += 1; };
            }
        }
    }

    #[abi(embed_v0)]
    impl ActionsImpl of IActions<ContractState> {

        // ── EGS game creation from pre-minted token ───────
        fn create_game_egs(ref self: ContractState, token_id: felt252) -> felt252 {
            let mut world = InternalImpl::world_default(@self);
            let caller = get_caller_address();
            let player_game: PlayerGame = world.read_model(caller);
            assert(player_game.game_id == 0, 'Already in a game');

            self.egs_pre(token_id);

            let zero: ContractAddress = starknet::contract_address_const::<0>();
            world.write_model(@Game {
                game_id: token_id, player1: caller, player2: zero,
                current_turn: caller, status: STATUS_LOBBY, winner: zero,
                turn_count: 0, p1_pieces_placed: 0, p2_pieces_placed: 0,
                created_at: get_block_timestamp(),
            });
            world.write_model(@PlayerGame { player: caller, game_id: token_id });
            self.egs_post(token_id);
            token_id
        }

        // ── Legacy create_game (backward compatible) ──────
        fn create_game(ref self: ContractState) -> felt252 {
            let mut world = InternalImpl::world_default(@self);
            let caller = get_caller_address();
            let player_game: PlayerGame = world.read_model(caller);
            assert(player_game.game_id == 0, 'Already in a game');
            let mut counter: GameCounter = world.read_model(0);
            counter.count += 1;
            world.write_model(@counter);
            let game_id: felt252 = counter.count;
            let zero: ContractAddress = starknet::contract_address_const::<0>();
            world.write_model(@Game {
                game_id, player1: caller, player2: zero, current_turn: caller,
                status: STATUS_LOBBY, winner: zero, turn_count: 0,
                p1_pieces_placed: 0, p2_pieces_placed: 0, created_at: get_block_timestamp(),
            });
            world.write_model(@PlayerGame { player: caller, game_id });
            game_id
        }

        fn join_game(ref self: ContractState, game_id: felt252) {
            let mut world = InternalImpl::world_default(@self);
            let caller = get_caller_address();
            let player_game: PlayerGame = world.read_model(caller);
            assert(player_game.game_id == 0, 'Already in a game');
            let mut game: Game = world.read_model(game_id);
            assert(game.status == STATUS_LOBBY, 'Game not open');
            assert(game.player1 != caller, 'Cannot join own game');
            game.player2 = caller; game.status = STATUS_PLACING;
            world.write_model(@game);
            world.write_model(@PlayerGame { player: caller, game_id });
        }

        fn place_piece(ref self: ContractState, game_id: felt252, piece_id: u8, x: u8, y: u8, rank_commitment: felt252) {
            let mut world = InternalImpl::world_default(@self);
            let caller = get_caller_address();
            let mut game: Game = world.read_model(game_id);
            assert(game.status == STATUS_PLACING, 'Not placement phase');
            assert(caller == game.player1 || caller == game.player2, 'Not a player');
            let is_p1 = caller == game.player1;
            if is_p1 {
                assert(piece_id < PIECES_PER_PLAYER, 'Invalid piece id for p1');
                assert(y <= P1_MAX_ROW, 'P1: rows 0-3 only');
            } else {
                assert(piece_id >= PIECES_PER_PLAYER && piece_id < PIECES_PER_PLAYER * 2, 'Invalid piece id for p2');
                assert(y >= P2_MIN_ROW, 'P2: rows 6-9 only');
            }
            assert(x < BOARD_SIZE && y < BOARD_SIZE, 'Out of bounds');
            let square: Square = world.read_model((game_id, x, y));
            assert(!square.is_occupied, 'Square occupied');
            let existing: Piece = world.read_model((game_id, piece_id));
            assert(!existing.is_placed, 'Piece already placed');
            world.write_model(@Piece {
                game_id, piece_id, owner: caller, x, y, rank_commitment,
                revealed_rank: 0, is_alive: true, is_revealed: false, is_placed: true,
            });
            world.write_model(@Square { game_id, x, y, piece_id, is_occupied: true });
            if is_p1 { game.p1_pieces_placed += 1; } else { game.p2_pieces_placed += 1; }
            world.write_model(@game);
        }

        fn ready(ref self: ContractState, game_id: felt252) {
            let mut world = InternalImpl::world_default(@self);
            let caller = get_caller_address();
            let mut game: Game = world.read_model(game_id);
            assert(game.status == STATUS_PLACING, 'Not placement phase');
            assert(caller == game.player1 || caller == game.player2, 'Not a player');
            let is_p1 = caller == game.player1;
            if is_p1 { assert(game.p1_pieces_placed == PIECES_PER_PLAYER, 'Place all pieces first'); }
            else { assert(game.p2_pieces_placed == PIECES_PER_PLAYER, 'Place all pieces first'); }
            if game.p1_pieces_placed == PIECES_PER_PLAYER && game.p2_pieces_placed == PIECES_PER_PLAYER {
                game.status = STATUS_ACTIVE; game.current_turn = game.player1;
            }
            world.write_model(@game);
        }

        fn move_piece(ref self: ContractState, game_id: felt252, piece_id: u8, to_x: u8, to_y: u8, rank: u8, salt: felt252) {
            let mut world = InternalImpl::world_default(@self);
            let caller = get_caller_address();
            let mut game: Game = world.read_model(game_id);
            assert(game.status == STATUS_ACTIVE, 'Game not active');
            assert(game.current_turn == caller, 'Not your turn');
            let pending: PendingCombat = world.read_model(game_id);
            assert(!pending.is_active, 'Resolve combat first');
            let mut piece: Piece = world.read_model((game_id, piece_id));
            assert(piece.owner == caller, 'Not your piece');
            assert(piece.is_alive, 'Piece is dead');
            assert(piece.is_placed, 'Piece not placed');
            InternalImpl::verify_commitment(piece.rank_commitment, rank, salt);

            self.egs_pre(game_id);

            let from_x = piece.x; let from_y = piece.y;
            if rank == RANK_SCOUT {
                InternalImpl::validate_scout_move(ref world, game_id, from_x, from_y, to_x, to_y);
            } else {
                let dx = if to_x >= from_x { to_x - from_x } else { from_x - to_x };
                let dy = if to_y >= from_y { to_y - from_y } else { from_y - to_y };
                assert((dx == 1 && dy == 0) || (dx == 0 && dy == 1), 'Invalid move');
            }
            let dest_square: Square = world.read_model((game_id, to_x, to_y));
            if !dest_square.is_occupied {
                piece.x = to_x; piece.y = to_y;
                world.write_model(@piece);
                world.write_model(@Square { game_id, x: from_x, y: from_y, piece_id: 255_u8, is_occupied: false });
                world.write_model(@Square { game_id, x: to_x, y: to_y, piece_id, is_occupied: true });
                game.turn_count += 1;
                game.current_turn = InternalImpl::opponent(@game, caller);
                world.write_model(@game);
            } else {
                let target: Piece = world.read_model((game_id, dest_square.piece_id));
                assert(target.owner != caller, 'Cannot attack own piece');
                piece.revealed_rank = rank; piece.is_revealed = true;
                world.write_model(@piece);
                world.write_model(@PendingCombat {
                    game_id, is_active: true, attacker_piece_id: piece_id,
                    attacker_rank: rank, defender_piece_id: dest_square.piece_id,
                    from_x, from_y, to_x, to_y,
                });
            }
            self.egs_post(game_id);
        }

        fn resolve_combat(ref self: ContractState, game_id: felt252, piece_id: u8, rank: u8, salt: felt252) {
            let mut world = InternalImpl::world_default(@self);
            let caller = get_caller_address();
            let game: Game = world.read_model(game_id);
            assert(game.status == STATUS_ACTIVE, 'Game not active');
            let pending: PendingCombat = world.read_model(game_id);
            assert(pending.is_active, 'No pending combat');
            assert(pending.defender_piece_id == piece_id, 'Wrong piece');
            let mut defender: Piece = world.read_model((game_id, piece_id));
            assert(defender.owner == caller, 'Not your piece');
            InternalImpl::verify_commitment(defender.rank_commitment, rank, salt);

            self.egs_pre(game_id);

            let attacker_rank = pending.attacker_rank;
            defender.revealed_rank = rank; defender.is_revealed = true;
            world.write_model(@defender);

            if rank == RANK_FLAG {
                let attacker: Piece = world.read_model((game_id, pending.attacker_piece_id));
                let mut ended_game: Game = world.read_model(game_id);
                ended_game.status = STATUS_FINISHED; ended_game.winner = attacker.owner;
                world.write_model(@ended_game);
                InternalImpl::kill_piece(ref world, game_id, piece_id, pending.to_x, pending.to_y);
                InternalImpl::do_move(ref world, game_id, pending.attacker_piece_id, pending.from_x, pending.from_y, pending.to_x, pending.to_y);
                world.write_model(@PlayerGame { player: ended_game.player1, game_id: 0 });
                world.write_model(@PlayerGame { player: ended_game.player2, game_id: 0 });
                InternalImpl::award_loss(ref world, caller, game_id);
                InternalImpl::clear_combat(ref world, game_id);
                self.egs_post(game_id);
                return;
            }

            if rank == RANK_BOMB {
                if attacker_rank == RANK_MINER {
                    InternalImpl::kill_piece(ref world, game_id, piece_id, pending.to_x, pending.to_y);
                    InternalImpl::do_move(ref world, game_id, pending.attacker_piece_id, pending.from_x, pending.from_y, pending.to_x, pending.to_y);
                } else {
                    InternalImpl::kill_piece(ref world, game_id, pending.attacker_piece_id, pending.from_x, pending.from_y);
                }
            } else if attacker_rank == RANK_SPY && rank == RANK_MARSHAL {
                InternalImpl::kill_piece(ref world, game_id, piece_id, pending.to_x, pending.to_y);
                InternalImpl::do_move(ref world, game_id, pending.attacker_piece_id, pending.from_x, pending.from_y, pending.to_x, pending.to_y);
            } else if attacker_rank > rank {
                InternalImpl::kill_piece(ref world, game_id, piece_id, pending.to_x, pending.to_y);
                InternalImpl::do_move(ref world, game_id, pending.attacker_piece_id, pending.from_x, pending.from_y, pending.to_x, pending.to_y);
            } else if attacker_rank < rank {
                InternalImpl::kill_piece(ref world, game_id, pending.attacker_piece_id, pending.from_x, pending.from_y);
            } else {
                InternalImpl::kill_piece(ref world, game_id, piece_id, pending.to_x, pending.to_y);
                InternalImpl::kill_piece(ref world, game_id, pending.attacker_piece_id, pending.from_x, pending.from_y);
            }

            InternalImpl::clear_combat(ref world, game_id);
            let mut updated_game: Game = world.read_model(game_id);
            updated_game.turn_count += 1;
            updated_game.current_turn = InternalImpl::opponent(@updated_game, game.current_turn);
            world.write_model(@updated_game);
            self.egs_post(game_id);
        }

        fn forfeit(ref self: ContractState, game_id: felt252) {
            let mut world = InternalImpl::world_default(@self);
            let caller = get_caller_address();
            let mut game: Game = world.read_model(game_id);
            assert(caller == game.player1 || caller == game.player2, 'Not a player');
            assert(game.status != STATUS_FINISHED, 'Already finished');
            let winner = if caller == game.player1 { game.player2 } else { game.player1 };
            game.status = STATUS_FINISHED; game.winner = winner;
            world.write_model(@game);
            world.write_model(@PlayerGame { player: game.player1, game_id: 0 });
            world.write_model(@PlayerGame { player: game.player2, game_id: 0 });
            InternalImpl::award_loss(ref world, caller, game_id);
            self.egs_post(game_id);
        }

        fn claim_reward(ref self: ContractState, game_id: felt252) {
            let mut world = InternalImpl::world_default(@self);
            let caller = get_caller_address();
            let game: Game = world.read_model(game_id);
            assert(game.status == STATUS_FINISHED, 'Game not finished');
            assert(game.winner == caller, 'Only winner can claim');
            let claim: RewardClaim = world.read_model(game_id);
            assert(!claim.claimed, 'Already claimed');
            world.write_model(@RewardClaim { game_id, claimed: true, claimed_by: caller });
            let mut stats: PlayerStats = world.read_model(caller);
            stats.wins += 1; stats.points += POINTS_WIN; stats.last_session_id = game_id;
            world.write_model(@stats);
            self.egs_post(game_id);
        }
    }
}
