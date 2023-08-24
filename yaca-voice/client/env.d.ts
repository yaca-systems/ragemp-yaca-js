declare global {
    interface PlayerMp {
        yacaPlugin: {
            radioEnabled: boolean;
            cid: string;
            muted: boolean;
            range: number;
            phoneCallMemberIds?: number[];
            isTalking: boolean;
        };
        yacaPluginLocal: {
            canChangeVoiceRange: boolean;
            maxVoiceRange: number;
            lastMegaphoneState: boolean;
            canUseMegaphone: boolean;
        };
    }
}

export {};