import 'package:flutter/material.dart';

import '../main.dart';
import '../services/db_service.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _village = TextEditingController();
  final _district = TextEditingController();
  final _state = TextEditingController();
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    DbService.profile().then((p) {
      if (!mounted) return;
      _name.text = p?['full_name'] ?? '';
      _phone.text = p?['phone'] ?? '';
      _village.text = p?['village'] ?? '';
      _district.text = p?['district'] ?? '';
      _state.text = p?['state'] ?? '';
      setState(() => _loading = false);
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await DbService.updateProfile({
        'full_name': _name.text.trim(),
        'phone': _phone.text.trim(),
        'village': _village.text.trim(),
        'district': _district.text.trim(),
        'state': _state.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Profile saved')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scope = ThemeModeScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                TextField(
                    controller: _name,
                    decoration: const InputDecoration(labelText: 'Full name')),
                const SizedBox(height: 12),
                TextField(
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(labelText: 'Phone')),
                const SizedBox(height: 12),
                TextField(
                    controller: _village,
                    decoration: const InputDecoration(labelText: 'Village')),
                const SizedBox(height: 12),
                TextField(
                    controller: _district,
                    decoration: const InputDecoration(labelText: 'District')),
                const SizedBox(height: 12),
                TextField(
                    controller: _state,
                    decoration: const InputDecoration(labelText: 'State')),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _saving ? null : _save,
                  child: const Text('Save changes'),
                ),
                const SizedBox(height: 20),
                SwitchListTile(
                  title: const Text('Dark mode'),
                  value: scope.mode == ThemeMode.dark,
                  onChanged: (v) =>
                      scope.setMode(v ? ThemeMode.dark : ThemeMode.light),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.logout),
                  title: const Text('Sign out'),
                  onTap: () async {
                    await DbService.signOut();
                    if (context.mounted) {
                      Navigator.pushNamedAndRemoveUntil(
                          context, '/auth', (_) => false);
                    }
                  },
                ),
              ],
            ),
    );
  }
}
