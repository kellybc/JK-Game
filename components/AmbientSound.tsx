import React, { useEffect, useRef, useState } from 'react';
import { TileType } from '../types';

interface AmbientSoundProps {
    terrain: TileType;
}

export const AmbientSound: React.FC<AmbientSoundProps> = ({ terrain }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const nextNoteTimeRef = useRef<number>(0);
    const timerRef = useRef<number | null>(null);
    // Use a ref to track terrain so the scheduler loop always sees the latest value
    const terrainRef = useRef(terrain);

    useEffect(() => {
        terrainRef.current = terrain;
    }, [terrain]);

    // Scales (Frequencies)
    const SCALES: Record<string, number[]> = {
        MAJOR: [130.81, 146.83, 164.81, 174.61, 196.00, 220.00, 246.94, 261.63], // Town (C Major)
        MINOR_PENT: [164.81, 196.00, 220.00, 246.94, 293.66, 329.63, 392.00, 440.00], // Forest (E Minor Pent)
        CHROMATIC_LOW: [65.41, 69.30, 73.42, 77.78, 82.41, 87.31, 92.50, 98.00], // Dungeon/Mountain (Deep, dissonant)
        WHOLE_TONE: [130.81, 146.83, 164.81, 185.00, 207.65, 233.08] // Mystery/Water
    };

    const getScaleForTerrain = (t: TileType) => {
        switch(t) {
            case TileType.TOWN: return SCALES.MAJOR;
            case TileType.DUNGEON: return SCALES.CHROMATIC_LOW;
            case TileType.MOUNTAIN: return SCALES.CHROMATIC_LOW;
            case TileType.WATER: return SCALES.WHOLE_TONE;
            default: return SCALES.MINOR_PENT; // Forest, Plains
        }
    };

    const playNote = (ctx: AudioContext) => {
        const currentTerrain = terrainRef.current;
        const scale = getScaleForTerrain(currentTerrain);
        const freq = scale[Math.floor(Math.random() * scale.length)];
        
        const osc = ctx.createOscillator();
        // Dungeon gets Sawtooth for grit, Town gets Sine for purity, others Triangle
        osc.type = currentTerrain === TileType.DUNGEON ? 'sawtooth' : (currentTerrain === TileType.TOWN ? 'sine' : 'triangle');
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        const gain = ctx.createGain();
        const now = ctx.currentTime;
        
        // Attack/Release settings
        const attack = currentTerrain === TileType.TOWN ? 0.1 : 0.5;
        const release = currentTerrain === TileType.DUNGEON ? 3.0 : 2.0;

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.05, now + attack); 
        gain.gain.exponentialRampToValueAtTime(0.001, now + release);

        // Delay for atmosphere
        const delay = ctx.createDelay();
        delay.delayTime.value = currentTerrain === TileType.DUNGEON ? 0.6 : 0.3;
        
        const delayFeedback = ctx.createGain();
        delayFeedback.gain.value = 0.3;

        const delayFilter = ctx.createBiquadFilter();
        delayFilter.type = 'lowpass';
        delayFilter.frequency.value = currentTerrain === TileType.TOWN ? 2000 : 800;

        osc.connect(gain);
        gain.connect(ctx.destination);
        
        // Reverb path
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
        const currentTerrain = terrainRef.current;

        while (nextNoteTimeRef.current < ctx.currentTime + 0.1) {
            playNote(ctx);
            // Town = faster notes, Dungeon = slower notes
            const tempo = currentTerrain === TileType.TOWN ? 2 : 4;
            nextNoteTimeRef.current += 1 + Math.random() * tempo;
        }
        timerRef.current = window.setTimeout(scheduler, 250);
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