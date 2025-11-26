import React, { useEffect, useRef, useState } from 'react';
import { TileType } from '../types';

interface AmbientSoundProps {
    terrain: TileType;
    isCombat: boolean;
}

export const AmbientSound: React.FC<AmbientSoundProps> = ({ terrain, isCombat }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const nextNoteTimeRef = useRef<number>(0);
    const timerRef = useRef<number | null>(null);
    
    const terrainRef = useRef(terrain);
    const combatRef = useRef(isCombat);

    useEffect(() => {
        terrainRef.current = terrain;
        combatRef.current = isCombat;
    }, [terrain, isCombat]);

    // Scales (Frequencies)
    const SCALES: Record<string, number[]> = {
        MAJOR: [130.81, 146.83, 164.81, 174.61, 196.00, 220.00, 246.94, 261.63], // Town (C Major)
        MINOR_PENT: [164.81, 196.00, 220.00, 246.94, 293.66, 329.63, 392.00, 440.00], // Forest (E Minor Pent)
        CHROMATIC_LOW: [65.41, 69.30, 73.42, 77.78, 82.41, 87.31, 92.50, 98.00], // Dungeon (Deep)
        WHOLE_TONE: [130.81, 146.83, 164.81, 185.00, 207.65, 233.08], // Mystery
        COMBAT: [123.47, 130.81, 155.56, 164.81, 196.00, 207.65, 246.94, 261.63] // Phrygian Dominant (Tension)
    };

    const getScale = () => {
        if (combatRef.current) return SCALES.COMBAT;
        const t = terrainRef.current;
        switch(t) {
            case TileType.TOWN: return SCALES.MAJOR;
            case TileType.DUNGEON: return SCALES.CHROMATIC_LOW;
            case TileType.MOUNTAIN: return SCALES.CHROMATIC_LOW;
            case TileType.WATER: return SCALES.WHOLE_TONE;
            case TileType.INN: return SCALES.MAJOR;
            default: return SCALES.MINOR_PENT;
        }
    };

    const playNote = (ctx: AudioContext) => {
        const scale = getScale();
        const freq = scale[Math.floor(Math.random() * scale.length)];
        
        const osc = ctx.createOscillator();
        const isBattle = combatRef.current;
        
        osc.type = isBattle ? 'sawtooth' : (terrainRef.current === TileType.TOWN ? 'sine' : 'triangle');
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        const gain = ctx.createGain();
        const now = ctx.currentTime;
        
        const attack = isBattle ? 0.05 : 0.5;
        const release = isBattle ? 0.3 : 2.0;

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(isBattle ? 0.1 : 0.05, now + attack); 
        gain.gain.exponentialRampToValueAtTime(0.001, now + release);

        // Delay for atmosphere
        const delay = ctx.createDelay();
        delay.delayTime.value = isBattle ? 0.2 : 0.4;
        
        const delayFeedback = ctx.createGain();
        delayFeedback.gain.value = isBattle ? 0.1 : 0.3;

        const delayFilter = ctx.createBiquadFilter();
        delayFilter.type = 'lowpass';
        delayFilter.frequency.value = isBattle ? 3000 : 1000;

        osc.connect(gain);
        gain.connect(ctx.destination);
        
        gain.connect(delay);
        delay.connect(delayFeedback);
        delayFeedback.connect(delayFilter);
        delayFilter.connect(delay);
        delay.connect(ctx.destination);

        osc.start();
        osc.stop(now + release + 1);
    };

    const scheduler = () => {
        if (!audioContextRef.current) return;
        const ctx = audioContextRef.current;
        const isBattle = combatRef.current;

        while (nextNoteTimeRef.current < ctx.currentTime + 0.1) {
            playNote(ctx);
            // Combat = fast (0.2s - 0.5s), Exploration = slow (1s - 4s)
            const tempo = isBattle ? 0.3 : (terrainRef.current === TileType.TOWN ? 2 : 4);
            nextNoteTimeRef.current += (isBattle ? 0.1 : 1) + Math.random() * tempo;
        }
        timerRef.current = window.setTimeout(scheduler, 100);
    };

    const toggleSound = () => {
        if (isPlaying) {
            if (timerRef.current) clearTimeout(timerRef.current);
            audioContextRef.current?.close();
            audioContextRef.current = null;
            setIsPlaying(false);
        } else {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioCtx();
            audioContextRef.current = ctx;
            if (ctx.state === 'suspended') ctx.resume();
            nextNoteTimeRef.current = ctx.currentTime + 0.1;
            scheduler();
            setIsPlaying(true);
        }
    };

    useEffect(() => {
        return () => {
             if (timerRef.current) clearTimeout(timerRef.current);
             audioContextRef.current?.close();
        };
    }, []);

    return (
        <button 
            onClick={toggleSound}
            className={`p-2 rounded border transition-all ${
                isPlaying 
                ? 'bg-mythic-gold text-mythic-900 border-mythic-gold' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title={isPlaying ? "Mute Music" : "Play Music"}
        >
            {isPlaying ? '🎵' : '🔇'}
        </button>
    );
};