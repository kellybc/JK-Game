import React, { useEffect, useRef, useState } from 'react';

export const AmbientSound = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const nextNoteTimeRef = useRef<number>(0);
    const timerRef = useRef<number | null>(null);

    // E Minor Pentatonic Scale Frequencies (spanning a few octaves)
    // E3, G3, A3, B3, D4, E4, G4, A4
    const scale = [164.81, 196.00, 220.00, 246.94, 293.66, 329.63, 392.00, 440.00];

    const toggleSound = () => {
        if (isPlaying) {
            stopSound();
        } else {
            startSound();
        }
    };

    const playNote = (ctx: AudioContext) => {
        // Pick a random note from the scale
        const freq = scale[Math.floor(Math.random() * scale.length)];
        
        // Create Oscillator (Triangle for flute-like, Sine for bell-like)
        const osc = ctx.createOscillator();
        osc.type = Math.random() > 0.5 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        // Envelope (ADSR-ish)
        const gain = ctx.createGain();
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.5); // Attack
        gain.gain.exponentialRampToValueAtTime(0.001, now + 4.0); // Long Release

        // Simple Reverb/Echo Simulation using Delay
        const delay = ctx.createDelay();
        delay.delayTime.value = 0.4; // 400ms echo
        
        const delayFeedback = ctx.createGain();
        delayFeedback.gain.value = 0.3; // 30% feedback

        const delayFilter = ctx.createBiquadFilter();
        delayFilter.type = 'lowpass';
        delayFilter.frequency.value = 1000; // Dampen high frequencies on repeats

        // Connections:
        // Osc -> Gain -> Output
        // Gain -> Delay -> Feedback -> Filter -> Delay (Loop)
        // Delay -> Output

        osc.connect(gain);
        gain.connect(ctx.destination);
        
        // Echo Path
        gain.connect(delay);
        delay.connect(delayFeedback);
        delayFeedback.connect(delayFilter);
        delayFilter.connect(delay);
        delay.connect(ctx.destination);

        osc.start();
        osc.stop(now + 5.0);
    };

    const scheduler = () => {
        if (!audioContextRef.current) return;
        const ctx = audioContextRef.current;

        // While there are notes that will need to play before the next interval
        while (nextNoteTimeRef.current < ctx.currentTime + 0.1) {
            playNote(ctx);
            // Schedule next note randomly between 2 and 6 seconds
            nextNoteTimeRef.current += 2 + Math.random() * 4;
        }
        
        timerRef.current = window.setTimeout(scheduler, 250);
    };

    const startSound = () => {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        
        nextNoteTimeRef.current = ctx.currentTime + 0.1;
        scheduler();
        setIsPlaying(true);
    };

    const stopSound = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        setIsPlaying(false);
    };

    useEffect(() => {
        return () => stopSound();
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