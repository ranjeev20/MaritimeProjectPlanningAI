import os
import io
from typing import List, Optional
from azure.storage.blob import BlobServiceClient
from loguru import logger
from core.config import settings

class AzureStorageService:
    def __init__(self):
        self.client: Optional[BlobServiceClient] = None
        
        # Determine connection method
        if settings.AZURE_STORAGE_CONNECTION_STRING:
            try:
                self.client = BlobServiceClient.from_connection_string(
                    settings.AZURE_STORAGE_CONNECTION_STRING
                )
                logger.info("Azure Storage client initialized via Connection String.")
            except Exception as e:
                logger.error(f"Failed to initialize Azure Storage client via Connection String: {e}")
        elif settings.AZURE_STORAGE_ACCOUNT_NAME and settings.AZURE_STORAGE_ACCOUNT_KEY:
            try:
                account_url = f"https://{settings.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net"
                self.client = BlobServiceClient(
                    account_url,
                    credential=settings.AZURE_STORAGE_ACCOUNT_KEY
                )
                logger.info("Azure Storage client initialized via Account Name & Key.")
            except Exception as e:
                logger.error(f"Failed to initialize Azure Storage client via Account Name/Key: {e}")
        else:
            logger.warning(
                "Azure Storage settings are not configured. Azure Storage operations will fail. "
                "Please configure AZURE_STORAGE_CONNECTION_STRING or Account Name & Key in .env"
            )

    def _get_client(self) -> BlobServiceClient:
        if not self.client:
            raise ValueError(
                "Azure Storage Service is not configured. "
                "Check AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT_NAME & AZURE_STORAGE_ACCOUNT_KEY in .env"
            )
        return self.client

    def upload_blob(self, container_name: str, blob_name: str, data: bytes) -> str:
        """
        Uploads data as a blob to the specified container.
        Creates the container if it does not exist.
        Returns the blob URL.
        """
        client = self._get_client()
        container_client = client.get_container_client(container_name)
        
        # Check if container exists, create if not
        try:
            container_client.get_container_properties()
        except Exception:
            logger.info(f"Container '{container_name}' does not exist. Creating it...")
            try:
                container_client.create_container()
            except Exception as cre:
                logger.error(f"Could not create container '{container_name}': {cre}")

        blob_client = container_client.get_blob_client(blob_name)
        blob_client.upload_blob(data, overwrite=True)
        logger.info(f"Successfully uploaded blob '{blob_name}' to container '{container_name}'.")
        return blob_client.url

    def download_blob(self, container_name: str, blob_name: str) -> bytes:
        """
        Downloads the specified blob from the container.
        Returns the data as bytes.
        """
        client = self._get_client()
        blob_client = client.get_blob_client(container=container_name, blob=blob_name)
        download_stream = blob_client.download_blob()
        return download_stream.readall()

    def list_blobs(self, container_name: str) -> List[str]:
        """
        Lists all blob names in the specified container.
        """
        client = self._get_client()
        container_client = client.get_container_client(container_name)
        try:
            # First check if the container exists
            container_client.get_container_properties()
            blobs = container_client.list_blobs()
            return [b.name for b in blobs]
        except Exception as e:
            logger.error(f"Error listing blobs in container '{container_name}': {e}")
            return []

    def delete_blob(self, container_name: str, blob_name: str) -> bool:
        """
        Deletes the specified blob.
        """
        client = self._get_client()
        blob_client = client.get_blob_client(container=container_name, blob=blob_name)
        try:
            blob_client.delete_blob()
            logger.info(f"Deleted blob '{blob_name}' from container '{container_name}'.")
            return True
        except Exception as e:
            logger.error(f"Error deleting blob '{blob_name}': {e}")
            return False

# Initialize a singleton service instance
azure_storage = AzureStorageService()
