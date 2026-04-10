import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors, spacing, typography } from '../theme/colors';
import ServiceCard from '../components/ServiceCard';

const SERVICES = [
  { id: '1', title: 'Lavage Express', description: 'Lavage extérieur rapide. Idéal pour un coup de propre entre deux lavages complets.', price: '15 €', icon: 'express' },
  { id: '2', title: 'Lavage Complet', description: 'Extérieur soigné + aspiration intérieur + plastiques. Notre best-seller.', price: '35 €', icon: 'wash' },
  { id: '3', title: 'Intérieur Pro', description: 'Nettoyage profond des sièges, tapis et tableau de bord. Détails impeccables.', price: '45 €', icon: 'interior' },
  { id: '4', title: 'Pack Premium', description: 'Tout inclus + traitement céramique et polish des phares.', price: '89 €', icon: 'premium' },
  { id: '5', title: 'Abonnement Mensuel', description: '2 lavages complets par mois. Économisez 20% sur l\'année.', price: '56 €/mois', icon: 'premium' },
];

export default function ServicesScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Nos services</Text>
          <Text style={styles.subtitle}>Choisissez le lavage adapté à vos besoins</Text>
        </View>

        {SERVICES.map((service) => (
          <ServiceCard
            key={service.id}
            {...service}
            onPress={() => navigation.navigate('Réservations')}
          />
        ))}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.xxxl,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
  },
});
