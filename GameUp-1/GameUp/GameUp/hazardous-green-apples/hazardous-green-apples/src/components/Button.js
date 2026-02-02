import React from 'react';
import { View } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';

// Wrapper component that removes shadows from Paper Button
// This creates a flat design by disabling all shadow/elevation properties
// Wraps in View to isolate shadow properties and ensure they don't appear
export const Button = ({ style, contentStyle, ...props }) => {
  return (
    <View style={{ elevation: 0, shadowOpacity: 0 }}>
      <PaperButton
        {...props}
        style={[
          style,
          {
            elevation: 0, // Android: remove elevation shadow
            shadowOpacity: 0, // iOS: remove shadow opacity
            shadowRadius: 0, // iOS: remove shadow radius
          },
        ]}
        contentStyle={[
          contentStyle,
          {
            elevation: 0,
            shadowOpacity: 0,
            shadowRadius: 0,
          },
        ]}
      />
    </View>
  );
};

