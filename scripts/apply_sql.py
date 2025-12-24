#!/usr/bin/env python3
"""
Script de Migración de Base de Datos para Antigravity Omega.
Ejecutado automáticamente por Render durante la fase 'preDeployCommand'.
"""

import os
import sys
import logging
import psycopg2

# Configuración de Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

def get_db_connection():
    """
    Establece una conexión segura a la base de datos PostgreSQL.
    """
    database_url = os.environ.get('POSTGRES_DSN') or os.environ.get('DATABASE_URL')
    
    if not database_url:
        logger.critical("Error Fatal: La variable de entorno DATABASE_URL no está definida.")
        sys.exit(1)

    try:
        # Render requiere SSL para conexiones externas
        conn = psycopg2.connect(database_url, sslmode='require')
        return conn
    except Exception as e:
        logger.error(f"Error conectando a la base de datos: {e}")
        sys.exit(1)

def apply_sql_script(conn, file_path):
    """
    Ejecuta un archivo SQL dentro de una transacción.
    """
    if not os.path.exists(file_path):
        logger.warning(f"Script no encontrado: {file_path}. Saltando.")
        return

    try:
        with conn.cursor() as cur:
            logger.info(f"Aplicando script: {file_path}")
            with open(file_path, 'r', encoding='utf-8') as f:
                sql_content = f.read()
            
            # Ejecutar contenido completo
            cur.execute(sql_content)
            logger.info(f"Éxito: {file_path} completado.")
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Fallo en {file_path}: {e}")
        sys.exit(1)

def main():
    logger.info("Iniciando Utilidad de Actualización de Base de Datos Antigravity Omega...")
    
    conn = get_db_connection()
    
    try:
        # 1. Definir los scripts a ejecutar en sesión
        # Primero el particionamiento (Nexus Protocol)
        apply_sql_script(conn, "scripts/migration_nexus_partitioning.sql")
        
        # 2. Otros scripts si fueran necesarios
        # apply_sql_script(conn, "scripts/other_migration.sql")
        
    finally:
        if conn:
            conn.close()
            logger.info("Conexión a base de datos cerrada.")

if __name__ == "__main__":
    main()
