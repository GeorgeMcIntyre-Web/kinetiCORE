// User Level Context - Progressive disclosure system
// Owner: George (Architecture)
// Framework: Technical GUI Design Framework - User Experience Levels

import React, { createContext, useContext, useState, ReactNode } from 'react';

/**
 * User experience levels following framework specification
 * - essential: Student/Beginner - simplified interface
 * - professional: Engineer/Designer - full professional tools
 * - expert: Power User/Enterprise - advanced features + customization
 */
export type UserLevel = 'essential' | 'professional' | 'expert';

interface UserLevelContextType {
  userLevel: UserLevel;
  setUserLevel: (level: UserLevel) => void;
}

const UserLevelContext = createContext<UserLevelContextType | undefined>(undefined);

interface UserLevelProviderProps {
  children: ReactNode;
  defaultLevel?: UserLevel;
}

/**
 * Provider component for user level context
 * Wraps the app and makes user level available to all components
 */
export const UserLevelProvider: React.FC<UserLevelProviderProps> = ({
  children,
  defaultLevel = 'essential', // Start with simplest mode
}) => {
  const [userLevel, setUserLevel] = useState<UserLevel>(defaultLevel);

  return (
    <UserLevelContext.Provider value={{ userLevel, setUserLevel }}>
      {children}
    </UserLevelContext.Provider>
  );
};

/**
 * Hook to access current user level and setter
 * Usage: const { userLevel, setUserLevel } = useUserLevel();
 */
export const useUserLevel = (): UserLevelContextType => {
  const context = useContext(UserLevelContext);
  if (!context) {
    throw new Error('useUserLevel must be used within UserLevelProvider');
  }
  return context;
};

/**
 * Helper hook to check if specific level or higher
 * Usage: const isPro = useIsLevel('professional'); // true for pro & expert
 */
export const useIsLevel = (minLevel: UserLevel): boolean => {
  const { userLevel } = useUserLevel();

  const levels: UserLevel[] = ['essential', 'professional', 'expert'];
  const currentIndex = levels.indexOf(userLevel);
  const requiredIndex = levels.indexOf(minLevel);

  return currentIndex >= requiredIndex;
};
