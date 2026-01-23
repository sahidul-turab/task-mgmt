'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Option {
    label: string;
    value: string;
}

interface SearchableDropdownProps {
    options: (string | Option)[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    icon: React.ReactNode;
    disabled?: boolean;
    searchable?: boolean;
    className?: string;
    showAllOption?: boolean;
}

export default function SearchableDropdown({
    options,
    value,
    onChange,
    placeholder,
    icon,
    disabled,
    searchable = true,
    className = "w-full sm:w-48",
    showAllOption = true
}: SearchableDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const normalizedOptions: Option[] = options.map(opt =>
        typeof opt === 'string' ? { label: opt, value: opt } : opt
    );

    const filteredOptions = normalizedOptions.filter(option =>
        option.label.toLowerCase().includes(search.toLowerCase())
    );

    const selectedOption = normalizedOptions.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`relative ${className} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className="w-full flex items-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl border border-[var(--border-muted)] bg-[var(--card)]/30 backdrop-blur-sm pl-2.5 sm:pl-3 pr-7 sm:pr-8 py-1 sm:py-1.5 text-[10px] sm:text-xs text-[var(--text)] transition-all hover:border-[var(--primary)]/30 focus:outline-none text-left h-[28px] sm:h-[30px]"
            >
                <span className="text-[var(--text-subtle)] flex-shrink-0 scale-90 sm:scale-100">{icon}</span>
                <span className="truncate font-bold">{selectedOption ? selectedOption.label : placeholder}</span>
                {value && !disabled ? (
                    <X
                        size={11}
                        className="absolute right-6 sm:right-7 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] hover:text-[var(--danger)] transition-colors z-10"
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange('');
                        }}
                    />
                ) : null}
                <ChevronDown size={12} className={`absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 mt-1 w-full min-w-[200px] rounded-xl border border-[var(--border-muted)] bg-[var(--card)] shadow-xl shadow-black/20 overflow-hidden"
                    >
                        {searchable && (
                            <div className="p-2 border-b border-[var(--border-muted)] relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-subtle)]" />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full bg-[var(--bg)]/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text)] outline-none focus:ring-1 focus:ring-[var(--primary)]/50"
                                />
                            </div>
                        )}
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            {showAllOption && (
                                <button
                                    onClick={() => {
                                        onChange('');
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                    className={`w-full text-left px-4 py-2 text-xs transition-colors hover:bg-[var(--primary)]/10 truncate ${!value ? 'text-[var(--primary)] font-bold bg-[var(--primary)]/5' : 'text-[var(--text-muted)]'}`}
                                >
                                    All {placeholder.replace('All ', '')}
                                </button>
                            )}
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => {
                                            onChange(option.value);
                                            setIsOpen(false);
                                            setSearch('');
                                        }}
                                        className={`w-full text-left px-4 py-2 text-xs transition-colors hover:bg-[var(--primary)]/10 truncate ${value === option.value ? 'text-[var(--primary)] font-bold bg-[var(--primary)]/5' : 'text-[var(--text)]'}`}
                                    >
                                        {option.label}
                                    </button>
                                ))
                            ) : (
                                <div className="px-4 py-3 text-xs text-[var(--text-subtle)] text-center">
                                    No matches found
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
