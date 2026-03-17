use starknet::ContractAddress;

#[dojo::contract]
pub mod game_setup {
    use dojo::model::ModelStorage;
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use cipher::models::{Game, STATUS_FINISHED};
    use game_components_embeddable_game_standard::minigame::interface::{
        IMinigameTokenData,
    };
    use game_components_embeddable_game_standard::minigame::minigame_component::MinigameComponent;
    use openzeppelin_introspection::src5::SRC5Component;
    use starknet::ContractAddress;

    // ── Components ────────────────────────────────────────
    component!(path: MinigameComponent, storage: minigame, event: MinigameEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);

    #[abi(embed_v0)]
    impl MinigameImpl = MinigameComponent::MinigameImpl<ContractState>;
    impl MinigameInternalImpl = MinigameComponent::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl SRC5Impl = SRC5Component::SRC5Impl<ContractState>;

    // ── Storage ───────────────────────────────────────────
    #[storage]
    struct Storage {
        #[substorage(v0)]
        minigame: MinigameComponent::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
    }

    // ── Events ────────────────────────────────────────────
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        MinigameEvent: MinigameComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> WorldStorage {
            self.world(@"cipher")
        }
    }

    // ── dojo_init: called once by sozo migrate ────────────
    // Registers Cipher with the provable.games registry automatically.
    fn dojo_init(
        ref self: ContractState,
        creator_address: ContractAddress,
        denshokan_address: ContractAddress,
    ) {
        self.minigame.initializer(
            creator_address,
            "Cipher",
            "Onchain Stratego battle game built on Dojo",
            "Zyrick",
            "Zyrick",
            "Strategy",
            "",
            Option::None, // color
            Option::None, // client_url
            Option::None, // renderer_address
            Option::None, // settings_address
            Option::None, // objectives_address
            denshokan_address,
            Option::None, // royalty_fraction
            Option::None, // skills_address
            1_u64,        // version
        );
    }

    // ── IMinigameTokenData ────────────────────────────────
    // token_id == game_id in Cipher.
    // score: 100 if player1 (token owner) won, 10 if lost, 0 if ongoing.
    // game_over: true when game.status == STATUS_FINISHED.
    #[abi(embed_v0)]
    impl TokenDataImpl of IMinigameTokenData<ContractState> {
        fn score(self: @ContractState, token_id: felt252) -> u64 {
            let world = self.world_default();
            let game: Game = world.read_model(token_id);
            if game.status != STATUS_FINISHED { return 0_u64; }
            if game.winner == game.player1 { 100_u64 } else { 10_u64 }
        }

        fn game_over(self: @ContractState, token_id: felt252) -> bool {
            let world = self.world_default();
            let game: Game = world.read_model(token_id);
            game.status == STATUS_FINISHED
        }

        fn score_batch(self: @ContractState, token_ids: Span<felt252>) -> Array<u64> {
            let mut results = array![];
            for token_id in token_ids { results.append(self.score(*token_id)); };
            results
        }

        fn game_over_batch(self: @ContractState, token_ids: Span<felt252>) -> Array<bool> {
            let mut results = array![];
            for token_id in token_ids { results.append(self.game_over(*token_id)); };
            results
        }
    }
}
