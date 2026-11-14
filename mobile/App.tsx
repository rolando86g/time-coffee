import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TextInput, Button, FlatList, SafeAreaView } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://erwcqodugsgduevtogxf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7i3g2sarOVjVeQxzxUUQ_Q_gmX1qTQ9';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function App() {
  const [mensajes, setMensajes] = useState<any[]>([]);
  const [nuevoTexto, setNuevoTexto] = useState('');

  const cargarMensajes = async () => {
    const { data } = await supabase
      .from('mensajes')
      .select('*')
      .order('id', { ascending: false });
    if (data) setMensajes(data);
  };

  useEffect(() => {
    cargarMensajes();
  }, []);

  const enviarMensaje = async () => {
    if (!nuevoTexto.trim()) return;
    await supabase.from('mensajes').insert([{ texto: nuevoTexto, origen: 'Mobile' }]);
    setNuevoTexto('');
    cargarMensajes();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titulo}>Hello World - Mobile</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          value={nuevoTexto}
          onChangeText={setNuevoTexto}
          placeholder="Escribí desde el celular..."
        />
        <Button title="Enviar" onPress={enviarMensaje} />
      </View>

      <Button title="Actualizar lista" onPress={cargarMensajes} color="#666" />

      <FlatList
        style={styles.lista}
        data={mensajes}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.texto}>{item.texto}</Text>
            <Text style={styles.badge}>{item.origen}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff', marginTop: 30 },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 15 },
  form: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', padding: 8, borderRadius: 6 },
  lista: { marginTop: 15 },
  item: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 6, marginBottom: 8 },
  texto: { fontSize: 16 },
  badge: { fontSize: 12, backgroundColor: '#e5e7eb', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }
});