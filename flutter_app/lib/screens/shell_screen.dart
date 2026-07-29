import 'package:flutter/material.dart';

import 'home_screen.dart';
import 'fields_screen.dart';
import 'weather_screen.dart';
import 'advisor_screen.dart';
import 'profile_screen.dart';
import 'chat_screen.dart';

class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key});

  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  int _index = 0;

  static const _tabs = [
    HomeScreen(),
    FieldsScreen(),
    WeatherScreen(),
    AdvisorScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _tabs),
      floatingActionButton: FloatingActionButton(
        onPressed: () => Navigator.push(
            context, MaterialPageRoute(builder: (_) => const ChatScreen())),
        child: const Icon(Icons.chat_bubble_outline),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.map_outlined), label: 'Fields'),
          NavigationDestination(icon: Icon(Icons.cloud_outlined), label: 'Weather'),
          NavigationDestination(icon: Icon(Icons.psychology_outlined), label: 'Advisor'),
          NavigationDestination(icon: Icon(Icons.person_outline), label: 'Profile'),
        ],
      ),
    );
  }
}
