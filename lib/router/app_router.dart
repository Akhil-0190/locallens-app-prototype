import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../screens/add_gem_screen.dart';
import '../screens/match_vibe_screen.dart';
import '../screens/pocket_guide_screen.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: '/guide',
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) {
        return Scaffold(
          body: navigationShell,
          bottomNavigationBar: NavigationBar(
            selectedIndex: navigationShell.currentIndex,
            onDestinationSelected: (index) {
              navigationShell.goBranch(
                index,
                initialLocation: index == navigationShell.currentIndex,
              );
            },
            destinations: const [
              NavigationDestination(
                icon: Icon(Icons.explore),
                label: 'Match Vibe',
              ),
              NavigationDestination(
                icon: Icon(Icons.map),
                label: 'Pocket Guide',
              ),
              NavigationDestination(
                icon: Icon(Icons.add_location_alt),
                label: 'Add Gem',
              ),
            ],
          ),
        );
      },
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/vibe',
              builder: (context, state) => const MatchVibeScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/guide',
              builder: (context, state) => const PocketGuideScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/add',
              builder: (context, state) => const AddGemScreen(),
            ),
          ],
        ),
      ],
    ),
  ],
);