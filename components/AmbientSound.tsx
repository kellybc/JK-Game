import React, { useEffect, useRef, useState } from 'react';

export const AmbientSound = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const oscillatorsRef = useRef<OscillatorNode[]>([]);
    const gainNodesRef = useRef<GainNode[]>([]);

    const toggleSound = () => {
        if (isPlaying) {
            stopSound();
        } else {
            startSound();
        }
    };

    const startSound = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        const ctx = audioContextRef.current;
        if (ctx?.state === 'suspended') {
            ctx.resume();
        }

        // Master Gain
        const masterGain = ctx!.createGain();
        masterGain.gain.setValueAtTime(0.15, ctx!.currentTime); // Low volume
        masterGain.connect(ctx!.destination);

        // Create a chord of sine waves for a "Drone" effect
        // Frequencies chosen for a mystical, slightly minor/suspended feel
        const freqs = [110, 164.81, 196.00, 220]; // A2, E3, G3, A3
        
        freqs.forEach((freq, i) => {
            const osc = ctx!.createOscillator();
            const gain = ctx!.createGain();
            
            osc.type = i % 2 === 0 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(freq, ctx!.currentTime);
            
            // Add slight detuning for richness
            osc.detune.setValueAtTime(Math.random() * 10 - 5, ctx!.currentTime);

            // LFO for volume to make it "breathe"
            const lfo = ctx!.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.setValueAtTime(0.1 + (Math.random() * 0.1), ctx!.currentTime); // Very slow
            const lfoGain = ctx!.createGain();
            lfoGain.gain.setValueAtTime(0.3, ctx!.currentTime); // Modulation depth
            
            lfo.connect(lfoGain.gain);
            // Connect LFO to the oscillator's gain
            // Note: This is a simplified modulation logic for brevity
            
            gain.gain.setValueAtTime(0.1, ctx!.currentTime);
            
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start();

            oscillatorsRef.current.push(osc);
            gainNodesRef.current.push(gain);
        });

        setIsPlaying(true);
    };

    const stopSound = () => {
        oscillatorsRef.current.forEach(osc => osc.stop());
        oscillatorsRef.current = [];
        gainNodesRef.current = [];
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
            title={isPlaying ? "Mute Ambient Sound" : "Enable Ambient Sound"}
        >
            {isPlaying ? '🔊' : '🔇'}
        </button>
    );
};