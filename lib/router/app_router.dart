// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../screens/add_gem_screen.dart';
import '../screens/contributor_content_management_screen.dart';
import '../screens/contributor_profile_screen.dart';
import '../screens/match_vibe_screen.dart';
import '../screens/offline_packs_screen.dart';
import '../screens/partner_subscription_screen.dart';
import '../screens/pocket_guide_screen.dart';
import '../screens/route_pass_screen.dart';
import '../screens/walking_route_screen.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: '/guide',
  routes: [
    GoRoute(
      path: '/route',
      builder: (context, state) => const WalkingRouteScreen(),
    ),
    GoRoute(
      path: '/offline-packs',
      builder: (context, state) => const OfflinePacksScreen(),
    ),
    GoRoute(
      path: '/contributor-profile',
      builder: (context, state) => const ContributorProfileScreen(),
    ),
    GoRoute(
      path: '/contributor-profile/:userId',
      builder: (context, state) {
        final userId = state.pathParameters['userId'] ?? 'usr_blr_782914';
        return ContributorProfileScreen(userId: userId);
      },
    ),
    GoRoute(
      path: '/contributor-content',
      builder: (context, state) => const ContributorContentManagementScreen(),
    ),
    GoRoute(
      path: '/route-passes',
      builder: (context, state) => const RoutePassScreen(),
    ),
    GoRoute(
      path: '/partner-subscriptions',
      builder: (context, state) => const PartnerSubscriptionScreen(),
    ),
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