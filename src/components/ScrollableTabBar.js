import React, { useRef, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_WIDTH = 76;
const TAB_PADDING_H = 8;

export default function ScrollableTabBar({ state, descriptors, navigation }) {
  const scrollRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const routesCount = state.routes.length;
  /** Peu d’onglets : on centre le groupe au milieu de l’écran */
  const centerTabs = routesCount <= 4;

  useEffect(() => {
    if (centerTabs || !scrollRef.current || routesCount === 0) return;
    const tabCenter = TAB_PADDING_H + state.index * TAB_WIDTH + TAB_WIDTH / 2;
    const scrollX = Math.max(0, tabCenter - 120);
    scrollRef.current.scrollTo({
      x: scrollX,
      animated: true,
    });
  }, [state.index, routesCount, centerTabs]);

  return (
    <View style={[styles.container, { paddingBottom: Math.max(10, insets.bottom) }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          centerTabs && {
            flexGrow: 1,
            minWidth: windowWidth,
            justifyContent: 'center',
            paddingHorizontal: 0,
          },
        ]}
        bounces={false}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tab}
              activeOpacity={0.7}
            >
              {options.tabBarIcon?.({ focused: isFocused })}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
    paddingBottom: 10,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: TAB_PADDING_H,
  },
  tab: {
    width: TAB_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
});
